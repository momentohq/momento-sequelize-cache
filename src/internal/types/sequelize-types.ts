import { FindOptions, InferAttributes, ModelAttributes, ModelStatic, Optional, CreateOptions, CreationAttributes, Identifier, NonNullFindOptions } from 'sequelize/types';
import {Model} from "sequelize";

export const VALID_SEQUELIZE_FIND_OPTIONS = [
    'where',
    'attributes',
    'raw',
    'plain',
    'include',
    'transaction'
] as const;

export type FindOptionsT<T extends ModelStatic<Model>, M extends InstanceType<T>> = Pick<
    FindOptions<InferAttributes<InstanceType<T>>>,
    typeof VALID_SEQUELIZE_FIND_OPTIONS[number]
>;
