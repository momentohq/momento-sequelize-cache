import {IClientGenerator} from "./cacheclient/client-generator";
import {IModelCache, } from "./internal/types/cache-types";

import {buildCacheKey} from "./internal/utilities/cache-utilities";
import ModelCache from "./model-cache";
import {ILogger} from "./logger/logger-factory";
import {LoggerManager} from "./logger/logger-manager";

export type ModelCacheOptions = {
    logger?: ILogger,
    compressionType?: CompressionType
}

export enum CompressionType {
    NONE,
    ZLIB,
    ZSTD
}

export async function modelCacheFactory(
    clientGenerator: IClientGenerator,
    options?: ModelCacheOptions,
) {

    if (options?.logger) {
        LoggerManager.setLogger(options?.logger);
    }

    const loggerInstance = LoggerManager.getLogger();

    // Create an instance of the ModelCache class
    const modelCache = await ModelCache.initializeCacheClient(clientGenerator, loggerInstance,
        options?.compressionType ? options?.compressionType : CompressionType.NONE);

    const factory: IModelCache = {
        ...({
            __debug: {
                // You can expose the buildCacheKey here from your ModelCache instance or class
                // This assumes buildCacheKey is either a static method or a method of the ModelCache instance
                buildCacheKey
            } as any
        } as any),

        wrap: modelCache.wrap.bind(modelCache)
    };

    return factory;
}
