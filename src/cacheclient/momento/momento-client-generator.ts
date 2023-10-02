import { CacheClient } from "@gomomento/sdk";
import { EagerCacheClientProps } from "@gomomento/sdk/dist/src/cache-client-props";
import {IClientGenerator} from "../client-generator";
import {MomentoClient} from "./momento-client";


export class MomentoClientGenerator implements IClientGenerator {
    private static instance: MomentoClientGenerator | null = null;
    #client: MomentoClient | null = null;

    private constructor(private props: EagerCacheClientProps) {}  // Make constructor private

    static getInstance(props: EagerCacheClientProps): MomentoClientGenerator {
        if (this.instance === null) {
            this.instance = new MomentoClientGenerator(props);
        }
        return this.instance;
    }

    async getClient(): Promise<MomentoClient> {
        if (this.#client === null) {
            const cacheClient = await CacheClient.create(this.props);
            this.#client = new MomentoClient(cacheClient);
        }
        return this.#client;
    }
}
