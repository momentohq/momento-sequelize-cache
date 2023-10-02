import {ICacheClient} from "./cache-client";

export interface IClientGenerator {
    getClient(): Promise<ICacheClient>;
}
