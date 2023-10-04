import {
    IModelCache,
    ReadOnlyModel, ReadOnlyModelArr,
    TCacheParams,
    TWrappedModelCache
} from "./internal/types/cache-types";
import {buildCacheKey, isQueryPossiblyCacheable} from "./internal/utilities/cache-utilities";
import Sequelize, {Model} from "sequelize";
import {FindOptionsT} from "./internal/types/sequelize-types";
import {IClientGenerator} from "./cacheclient/client-generator";
import {FindOptions} from "sequelize/types";
import {CacheGet, CacheSet} from "@gomomento/sdk";
import _ from "lodash";
import {ICacheClient} from "./cacheclient/cache-client";
import {ILogger} from "./logger/logger-factory";
import {ModelCacheOptions} from "./model-cache-factory";


export default class ModelCache implements IModelCache {
    private cacheClient: ICacheClient;  // Specify the type of cacheClient
    private log: ILogger;
    private forceCreateCache: boolean

    private constructor(cacheClient: ICacheClient,
                        logger: ILogger,
                        forceCreateCache: boolean) {
       this.cacheClient = cacheClient;
       this.log = logger;
       this.forceCreateCache = forceCreateCache;
    }

    public static async initializeCacheClient(clientGenerator: IClientGenerator,
                                              logger: ILogger,
                                              modelCacheOptions?: ModelCacheOptions): Promise<ModelCache> {
        const cacheClient = await clientGenerator.getClient();
        return new ModelCache(cacheClient, logger, modelCacheOptions?.forceCreateCache ?
                                                                        modelCacheOptions?.forceCreateCache : false);
    }

    private async cachedCall<T extends Sequelize.ModelStatic<Model>, R>(
        type: string,
        generator: () => any,
        model: T,
        options: FindOptions = {},
        cacheParams?: TCacheParams,
    ): Promise<R> {
        if (!isQueryPossiblyCacheable(options)) {
            this.log.debug(options as Record<string, unknown>, 'QUERY passes unsupported params and cannot be cached');
            throw new Error('QUERY passes unsupported params and cannot be cached');
        }

        const cacheKey = buildCacheKey(type, model, options);
        if (cacheKey === null) {
            // this query was potentially cacheable, but could not generate a valid cacheclient key
            // so just run the query directly.
            this.log.debug(options as Record<string, unknown>, 'QUERY was possibly cacheable, but specific call could not generate key');
            return await generator();
        }

        const tableNameInfo = model.getTableName();
        const tableName = (typeof tableNameInfo === 'string') ? tableNameInfo : tableNameInfo.tableName;

        if (this.forceCreateCache) {
            await this.cacheClient.createCache(tableName);
        }

        const existingData = await this.cacheClient.get(tableName, cacheKey);

        // this works for Momento
        if (existingData instanceof CacheGet.Hit) {
            if (existingData.valueString() === null || existingData.valueString() === 'undefined') {
                // for findOne/findByPk that return null
                return null as any; // TODO: how to properly return this type?
            }

            const loadedData = JSON.parse(existingData.valueString());

            if (options.raw || options.plain) {
                return loadedData;
            } else {
                if (_.isArray(loadedData)) {

                    return loadedData.map((d: any) => {
                        const builtModel = (model as any).build(d, {isNewRecord: false})
                        // case where aliasing was used and the model doesn't have those attributes
                        this.injectMissingData(d, builtModel);
                        return builtModel;
                    }) as any; // FIXME: remove need for 'any' here
                }
                const builtModel = (model as any).build(loadedData, {isNewRecord: false});
                // case where aliasing was used and the model doesn't have those attributes
                this.injectMissingData(loadedData, builtModel)
                return builtModel
            }
        }


        const results = await generator();

        function getData(data: any) {
            if (results === null) {
                return 'null'; // JSON stringified "null"
            }

            if (options.raw || options.plain) {
                return JSON.stringify(data);
            }

            if (!results) {
                return results;
            }

            if (typeof results === 'number') {
                // like for count() calls
                return results.toString();
            }

            return _.isArray(results)
                ? JSON.stringify(results.map((r: any) => (r === null ? r : r.get())))
                : JSON.stringify(results.get());
        }

        const data = getData(results)

        if (data !== undefined) {
            await this.cacheClient.set(tableName, cacheKey, data, {ttl: cacheParams?.ttl});
        }

        return results;
    }

    private injectMissingData(loadedData: any, builtModel: any) {
        for (let key in loadedData) {
            if (!builtModel.dataValues[key]) {
                builtModel.setDataValue(key, loadedData[key]);
            }
        }
    }

    wrap<T extends Sequelize.ModelStatic<Model>, M extends InstanceType<T>>(
        model: T,
        cacheParams?: TCacheParams
    ): TWrappedModelCache<T, M> {
        return {
            findByPk: async (id: number | string, options?: FindOptionsT<T, M>) => {
                const result =  await this.cachedCall<T, InstanceType<T> | null>(
                    'findByPk',
                    () => model.findByPk(id, options),
                    model,
                    {
                        ...options,
                        where: { id }
                    },
                    cacheParams,
                );

                if (!result) return null;

                return ReadOnlyModel(model, result, options);
            },
            findOne: async (options?: FindOptionsT<T, M>) => {
                const result = await this.cachedCall<T, InstanceType<T> | null>(
                    'findOne',
                    () => model.findOne(options),
                    model,
                    options,
                    cacheParams,
                );

                if (!result) return null;

                return ReadOnlyModel(model, result, options);
            },
            findAll: async (options?: FindOptionsT<T, M>) => {
                let result = await this.cachedCall<T, InstanceType<T>[]>(
                    'findAll',
                    () => model.findAll(options),
                    model,
                    options,
                    cacheParams,
                );

                return ReadOnlyModelArr(model, result, options);
            },
            count: async (options?: FindOptionsT<T, M>) => {
                return await this.cachedCall<T, number>(
                    'count',
                    () => model.count(options),
                    model,
                    options,
                    cacheParams
                );
            },
        };
    }
}
