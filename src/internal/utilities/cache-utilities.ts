import { FindOptions } from 'sequelize/types';
import _ from 'lodash';
import {VALID_SEQUELIZE_FIND_OPTIONS} from "../types/sequelize-types";
import {sequelizeUtilities} from "./sequelize-utilities";
import {LoggerManager} from "../../logger/logger-manager";

export function isQueryPossiblyCacheable(options: FindOptions): boolean {
    if (_.isEmpty(options)) {
        return true;
    }

    return Object.keys(options).every((key) =>
        VALID_SEQUELIZE_FIND_OPTIONS.includes(key as typeof VALID_SEQUELIZE_FIND_OPTIONS[number])
    );
}

export function buildCacheKey(type: string, model: any, userOptions: FindOptions): string | null {
    const options = { ...userOptions };
    const logger = LoggerManager.getLogger();

    if (options.transaction) {
        // never attempt to cacheclient a query in a transaction, since we
        // won't know if the object had been previously modified.
        logger.debug({ model: model.getTableName(), options }, 'buildCacheKey ignoring query with transaction');
        return null;
    }

    // if (options.include) {
    //     // todo: can we fix this with momento?
    //     // never attempt to cacheclient a query with an include, because we cannot recreate the object properly
    //     // after deserializing from redis
    //     logger.debug({ model: model.getTableName(), options }, 'buildCacheKey ignoring query with include');
    //     return null;
    // }

    // it may exist in the object with "undefined" as value, but we do not want to attempt to stringify it
    delete options.transaction;

    try {
        const tableName = model.getTableName();
        const cacheKey = ['rio:model-cacheclient', type, tableName, sequelizeUtilities(options)].join(':');
        logger.debug({ cacheKey, model: tableName, options }, `buildCacheKey returning key`);
        return cacheKey;
    } catch (err) {
        logger.error({ model: model.getTableName(), options, err }, 'buildCacheKey unable to build valid cacheclient key');
        return null;
    }
}


