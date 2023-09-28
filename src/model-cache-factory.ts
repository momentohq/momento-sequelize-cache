import {IClientGenerator} from "./cacheclient/client-generator";
import {IModelCache, } from "./internal/types/cache-types";

import {buildCacheKey} from "./internal/utilities/cache-utilities";
import ModelCache from "./model-cache";
import {ILogger} from "./logger/logger-factory";
import {LoggerManager} from "./logger/logger-manager";

export async function modelCacheFactory(
    clientGenerator: IClientGenerator,
    logger?: ILogger
) {

    if (logger) {
        LoggerManager.setLogger(logger);
    }

    const loggerInstance = LoggerManager.getLogger();

    // Create an instance of the ModelCache class
    const modelCache = await ModelCache.initializeCacheClient(clientGenerator, loggerInstance);

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
