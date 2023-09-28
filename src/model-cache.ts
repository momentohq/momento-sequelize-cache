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


export default class ModelCache implements IModelCache {
    private cacheClient: ICacheClient;  // Specify the type of cacheClient
    private log: ILogger;

    private constructor(cacheClient: ICacheClient,
                        logger: ILogger) {
       this.cacheClient = cacheClient;
       this.log = logger;
    }

    public static async initializeCacheClient(clientGenerator: IClientGenerator,
                                              logger: ILogger): Promise<ModelCache> {
        const cacheClient = await clientGenerator.getClient();
        return new ModelCache(cacheClient, logger);
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
        const existingData = await this.cacheClient.get(tableName, cacheKey);

        // this works for Momento
        if (existingData instanceof CacheGet.Hit) {
            const loadedData = JSON.parse(existingData.valueString());

            if (existingData.valueString() === null || existingData.valueString() === 'undefined') {
                // for findOne/findByPk that return null
                return null as any; // TODO: how to properly return this type?
            }
            if (options.raw || options.plain) {
                return loadedData;
            } else {
                if (_.isArray(loadedData)) {

                    return loadedData.map((d: any) => (model as any).build(d, {isNewRecord: false})) as any; // FIXME: remove need for 'any' here
                }
                return (model as any).build(loadedData, {isNewRecord: false});
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
            const resp = await this.cacheClient
                .set(tableName, cacheKey, data, {ttl: cacheParams?.ttl});

            if (resp instanceof CacheSet.Error) {
                throw resp;
            }
        }


        return results;
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
                if (options?.raw || options?.plain) return result;

                return ReadOnlyModel(model, result);
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
                if (options?.raw || options?.plain) return result;

                return ReadOnlyModel(model, result);
            },
            findAll: async (options?: FindOptionsT<T, M>) => {
                const result = await this.cachedCall<T, InstanceType<T>[]>(
                    'findAll',
                    () => model.findAll(options),
                    model,
                    options,
                    cacheParams,
                );

                if (options?.raw || options?.plain) return result;

                return ReadOnlyModelArr(model, result).map(item => item as InstanceType<T>);
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
