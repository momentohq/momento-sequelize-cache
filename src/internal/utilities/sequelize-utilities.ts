import _ from 'lodash';

export const sequelizeUtilities = (value: any): string => {
    switch (typeof value) {
        case 'string':
            return `"${value}"`;
        case 'boolean':
            return String(value);
        case 'number':
            if (isNaN(value)) {
                throw new Error(`will not allow stringify of a NaN`);
            }
            return String(value);
        case 'bigint':
            return String(value);
        case 'symbol':
            return value.description || value.toString();
        case 'object':
            if (_.isArray(value)) {
                const items: string[] = [];
                for (const item of value) {
                    items.push(sequelizeUtilities(item));
                }
                return `[${items.join(',')}]`;
            } else if (value === null) {
                return 'null';
            } else if (value instanceof Date) {
                return sequelizeUtilities(value.toISOString());
            } else if (_.isObject(value)) {
                const entries: string[][] = [];

                for (const key in value) {
                    entries.push([key, sequelizeUtilities((value as any)[key])]);
                }

                for (const symbol of Object.getOwnPropertySymbols(value)) {
                    const key = symbol.description || symbol.toString();
                    entries.push([key, sequelizeUtilities((value as any)[symbol])]);
                }

                if (entries.length === 0) {
                    return '{}';
                }

                return `{${entries.map(([entryKey, entryValue]) => `"${entryKey}":${entryValue}`).join(',')}}`;
            } else {
                throw new Error(`Will not allow stringinfying unrecognized object value "${String(value)}"`);
            }
        case 'function':
            if (typeof value.getTableName === 'function') {
                // assume this is a sequelize model and just return the table name
                return sequelizeUtilities(value.getTableName());
            }

            // otherwise just disallow functions
            throw new Error(`Will not allow stringifying function values`);
        case 'undefined':
            throw new Error(`Will not allow stringifying undefined values`);
        default:
            throw new Error(`Will not allow stringifying unknown type "${typeof value}"`);
    }
};
