import Sequelize, {Model} from "sequelize";
import {FindOptionsT} from "./sequelize-types";

export type TWrappedModelCache<T extends Sequelize.ModelStatic<Model>, M extends InstanceType<T>> = {
    findByPk: (id: number | string, options?: FindOptionsT<T, M>) => Promise<ExtendedModelDataValues<InstanceType<T>> | null>;
    findOne: (options?: FindOptionsT<T, M>) => Promise<ExtendedModelDataValues<InstanceType<T>> | null>;
    findAll: (options?: FindOptionsT<T, M>) => Promise<ExtendedModelDataValues<InstanceType<T>>[] >;
    count: (options?: FindOptionsT<T, M>) => Promise<number>;
};


export type TCacheParams = {
    ttl: number;
};

type ModelDataValues<T> = T extends Sequelize.Model<infer Attributes, string> ? Attributes : never;

interface GetterMethods<T> {
    get(key: keyof T): T[keyof T];
}
type AnyDataValues = { [key: string]: any };


type ExtendedModelDataValues<T> = ModelDataValues<T> & GetterMethods<ModelDataValues<T>> & AnyDataValues;

function toExtendedModelDataValues<T extends Sequelize.Model>(
    modelStatic: Sequelize.ModelStatic<Sequelize.Model<any, any>>,
    modelInstance: T,
    options?: FindOptionsT<any, any>
): ExtendedModelDataValues<T> {
    const attributes = modelStatic.getAttributes();
    const data: { [key: string]: any } = {};

    // fill in the model attributes
    for (const key in attributes) {
        if (attributes.hasOwnProperty(key)) {
            if (options?.plain === true || options?.raw === true) {
                data[key] = (modelInstance as any)[key];
            } else {
                data[key] = modelInstance.get(key as any);
            }
        }
    }

    // other k/v that might be present in the modelInstance but not a part of the model's attribute.
    if (options?.plain === true || options?.raw === true) {
        for (const key in modelInstance) {
            if (!(key in data)) {  // This condition prevents overwriting existing keys
                data[key] = modelInstance[key];
            }
        }
    } else {
        for (const key in modelInstance.dataValues) {
            if (!(key in data)) {  // This condition prevents overwriting existing keys
                data[key] = modelInstance.dataValues[key];
            }
        }
    }

    return {
        ...data as ModelDataValues<T>,
        get(key: keyof ModelDataValues<T>): ModelDataValues<T>[keyof ModelDataValues<T>] {
            return this[key];
        },
    };
}

function toExtendedModelDataValuesArr<T extends Sequelize.Model>(
    modelStatic: Sequelize.ModelStatic<Sequelize.Model<any, any>>,
    modelInstances: T[],
    options?: FindOptionsT<any, any>
): ExtendedModelDataValues<T>[] {

    // this is a special nuance of sequelize where if you request plain it ends up returning as a single
    // model instance without it being an array upon calling `findAll`. the parsing of results is generic to single vs multi find
    // calls so we are handling this here. Use sequelize `raw` with `findAll`
    if (options?.plain === true) {
        let parsedInstance: T;
        try {
            parsedInstance = modelInstances as unknown as T;
        } catch (err) {
            throw new Error("Failed to parse as modelInstance " + err);
        }
        return [toExtendedModelDataValues(modelStatic, parsedInstance, options)];
    }
    return modelInstances.map(modelInstance => toExtendedModelDataValues(modelStatic, modelInstance, options));
}

export function ReadOnlyModel<T extends Sequelize.ModelStatic<Sequelize.Model<any, any>>>(modelStatic: T, modelInstance: InstanceType<T>, options?: FindOptionsT<any, any>): ExtendedModelDataValues<InstanceType<T>> {
    return toExtendedModelDataValues(modelStatic, modelInstance, options);
}

export function ReadOnlyModelArr<T extends Sequelize.ModelStatic<Sequelize.Model<any, any>>>(modelStatic: T, modelInstance: InstanceType<T>[], options?: FindOptionsT<any, any>): ExtendedModelDataValues<InstanceType<T>>[] {
    return toExtendedModelDataValuesArr(modelStatic, modelInstance, options);
}

export interface IModelCache {
    wrap<T extends Sequelize.ModelStatic<Model>, M extends InstanceType<T>>(
        model: T,
        cacheParams?: TCacheParams,
    ): TWrappedModelCache<T, M>;
}
