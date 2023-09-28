import Sequelize, {Model} from "sequelize";
import {FindOptionsT} from "./sequelize-types";

export type TWrappedModelCache<T extends Sequelize.ModelStatic<Model>, M extends InstanceType<T>> = {
    findByPk: (id: number | string, options?: FindOptionsT<T, M>) => Promise<InstanceType<T> | null>;
    findOne: (options?: FindOptionsT<T, M>) => Promise<InstanceType<T> | null>;
    findAll: (options?: FindOptionsT<T, M>) => Promise<InstanceType<T>[]>;
    count: (options?: FindOptionsT<T, M>) => Promise<number>;
};


export type TCacheParams = {
    ttl: number;
};

type ModelDataValues<T> = T extends Sequelize.Model<infer Attributes, string> ? Attributes : never;

interface GetterMethods<T> {
    get(key: keyof T): T[keyof T];
}

type ExtendedModelDataValues<T> = ModelDataValues<T> & GetterMethods<ModelDataValues<T>>;

function toExtendedModelDataValues<T extends Sequelize.Model>(
    modelStatic: Sequelize.ModelStatic<Sequelize.Model<any, any>>,
    modelInstance: T
): ExtendedModelDataValues<T> {
    const attributes = modelStatic.getAttributes();
    const data: Partial<ModelDataValues<T>> = {};

    for (const key in attributes) {
        if (attributes.hasOwnProperty(key)) {
            // Now set the value on the data object, again bypassing type checking
            data[key as keyof ModelDataValues<T>] = modelInstance.get(key as any);
        }
    }

    return {
        ...data as ModelDataValues<T>,
        get(key: keyof ModelDataValues<T>): ModelDataValues<T>[keyof ModelDataValues<T>] {
            return this[key];
        }
    };
}

function toExtendedModelDataValuesArr<T extends Sequelize.Model>(
    modelStatic: Sequelize.ModelStatic<Sequelize.Model<any, any>>,
    modelInstances: T[]
): ExtendedModelDataValues<T>[] {
    return modelInstances.map(modelInstance => toExtendedModelDataValues(modelStatic, modelInstance));
}

export function ReadOnlyModel<T extends Sequelize.ModelStatic<Sequelize.Model<any, any>>>(modelStatic: T, modelInstance: InstanceType<T>): ExtendedModelDataValues<InstanceType<T>> {
    return toExtendedModelDataValues(modelStatic, modelInstance);
}

export function ReadOnlyModelArr<T extends Sequelize.ModelStatic<Sequelize.Model<any, any>>>(modelStatic: T, modelInstance: InstanceType<T>[]): ExtendedModelDataValues<InstanceType<T>>[] {
    return toExtendedModelDataValuesArr(modelStatic, modelInstance);
}

export interface IModelCache {
    wrap<T extends Sequelize.ModelStatic<Model>, M extends InstanceType<T>>(
        model: T,
        cacheParams?: TCacheParams,
    ): TWrappedModelCache<T, M>;
}
