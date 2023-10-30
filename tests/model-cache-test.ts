import {CompressionType, LoggerFactory, modelCacheFactory, MomentoClientGenerator} from "../src"
import {DataTypes, Model, Sequelize} from "sequelize";
import {CacheClient, CacheGet, Configurations, CredentialProvider} from "@gomomento/sdk";
import {IModelCache} from "../src/internal/types/cache-types";

let sequelize: Sequelize;

class UserModel extends Model {}
class UserGroupModel extends Model {}

let defaultModelCache: IModelCache;
// cacheClient for verifying data was cached through the wrapper/adapter
let cacheClient: CacheClient;

const CACHE_NAME = 'momento-sequelize-cache-integration-test'
beforeAll(async () => {

    sequelize = new Sequelize({ dialect: 'sqlite'});

    UserModel.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: DataTypes.STRING,
        dob: DataTypes.DATE,
        active: DataTypes.BOOLEAN
    }, {
        sequelize,
        modelName: 'UserModel'
    });
    await UserModel.sync({ force: true });
    defaultModelCache = await modelCacheFactory(
        MomentoClientGenerator.getInstance({
            configuration: Configurations.Laptop.latest(),
            credentialProvider: CredentialProvider.fromEnvironmentVariable({environmentVariableName: 'MOMENTO_API_KEY'}),
            defaultTtlSeconds: 60,
            modelCacheName: CACHE_NAME,
            forceCreateCache: true
        }), {logger: LoggerFactory.createLogger({logLevel: 'debug'})});


    cacheClient = await CacheClient.create({
        configuration: Configurations.Laptop.latest(),
        credentialProvider: CredentialProvider.fromEnvironmentVariable({environmentVariableName: 'MOMENTO_API_KEY'}),
        defaultTtlSeconds: 60,
    })


    UserGroupModel.init({
        group: DataTypes.STRING,
        UserId: {
            type: DataTypes.INTEGER,
            references: {
                model: UserModel,
                key: 'id'
            }
        }
    }, {
        sequelize,
        modelName: 'UserGroupModel'
    })
    await UserGroupModel.sync({ force: true });
    UserGroupModel.belongsTo(UserModel, { foreignKey: 'UserId' });

    seedData();
});

function seedData() {
    var data = [
        {
            'name': 'Taylor',
            'dob': new Date(1992, 1, 1),
            'active': true

        },
        {
            'name':'Alexa',
            'dob': new Date(1997, 11, 23),
            'active': false
        }
    ];
    UserModel.bulkCreate(data);
    var groupData = [
        {
            'UserId': 1,
            'group': 'blue'
        },
        {
            'UserId': 2,
            'group': 'red'
        }
    ]
    UserGroupModel.bulkCreate(groupData);
}

describe("ModelCache Tests", () => {
    it("should initialize ModelCache correctly", async () => {
        expect(defaultModelCache).toHaveProperty('wrap');
    });

    it("findAll returns both users cache hit and miss", async () => {
        let items = await defaultModelCache.wrap(UserModel).findAll();

        // cache miss
        expect(items[0].id).toEqual(1);
        expect(items[0].name).toEqual('Taylor');
        expect(items[0].active).toEqual(true);
        expect(items[0].dob).toBeInstanceOf(Date);
        expect(items[1].id).toEqual(2);
        expect(items[1].name).toEqual('Alexa');
        expect(items[1].active).toEqual(false);
        expect(items[1].dob).toBeInstanceOf(Date);

        // verify cache has items -- cache hit
        const cacheGet = await cacheClient.get(CACHE_NAME, 'model-cache:findAll:UserModels:{}');
        expect(cacheGet).toBeInstanceOf(CacheGet.Hit);

        const response = JSON.parse((cacheGet as CacheGet.Hit).valueString());
        for (let i = 0; i < response.length; i++) {
            expect(response[i].id).toEqual(items[i].id);
            expect(response[i].name).toEqual(items[i].name);
            expect(response[i].active).toEqual(items[i].active);
            expect(response[i].dob).toEqual(items[i].dob.toISOString());
        }

        // refetch again to make sure parsing works correctly
        items = await defaultModelCache.wrap(UserModel).findAll();
        expect(items[0].id).toEqual(1);
        expect(items[0].name).toEqual('Taylor');
        expect(items[0].active).toEqual(true);
        expect(items[0].dob).toBeInstanceOf(Date);
        expect(items[1].id).toEqual(2);
        expect(items[1].name).toEqual('Alexa');
        expect(items[1].active).toEqual(false);
        expect(items[1].dob).toBeInstanceOf(Date);

    });

    it("findOne happy path", async () => {
        let item = await defaultModelCache.wrap(UserModel).findOne({ where: { id: 1 } as any });
        // cache miss
        expect(item.id).toEqual(1);
        expect(item.name).toEqual('Taylor');
        expect(item.active).toEqual(true);
        expect(item.dob).toBeInstanceOf(Date);

        // cache hit
        item = await defaultModelCache.wrap(UserModel).findOne({ where: { id: 1 } as any });
        // cache miss
        expect(item.id).toEqual(1);
        expect(item.name).toEqual('Taylor');
        expect(item.active).toEqual(true);
        expect(item.dob).toBeInstanceOf(Date);

        // verify cache hit
        const cacheGet = await cacheClient.get(CACHE_NAME, 'model-cache:findOne:UserModels:{\"where\":{\"id\":1}}');
        expect(cacheGet).toBeInstanceOf(CacheGet.Hit);
    });

    it("findByPk happy path", async () => {
        let item = await defaultModelCache.wrap(UserModel).findByPk(2);
        // cache miss
        expect(item.id).toEqual(2);
        expect(item.name).toEqual('Alexa');
        expect(item.active).toEqual(false);
        expect(item.dob).toBeInstanceOf(Date);

        item = await defaultModelCache.wrap(UserModel).findByPk(2);
        // cache hit
        expect(item.id).toEqual(2);
        expect(item.name).toEqual('Alexa');
        expect(item.active).toEqual(false);
        expect(item.dob).toBeInstanceOf(Date);

        // verify cache hit
        const cacheGet = await cacheClient.get(CACHE_NAME, 'model-cache:findByPk:UserModels:{\"where\":{\"id\":2}}');
        expect(cacheGet).toBeInstanceOf(CacheGet.Hit);
    });

    it("findByPk happy path compression enabled", async () => {

        let compressedDataCache = await modelCacheFactory(
                MomentoClientGenerator.newInstance({
                    configuration: Configurations.Laptop.latest(),
                    credentialProvider: CredentialProvider.fromEnvironmentVariable({environmentVariableName: 'MOMENTO_API_KEY'}),
                    defaultTtlSeconds: 60,
                    modelCacheName: CACHE_NAME.concat("-compressed"),
                    forceCreateCache: true
                }), {logger: LoggerFactory.createLogger({logLevel: 'debug'}),
                    compressionType: CompressionType.ZLIB});

        let item = await compressedDataCache.wrap(UserModel)
            .findByPk(2);

        // cache miss
        expect(item.id).toEqual(2);
        expect(item.name).toEqual('Alexa');
        expect(item.active).toEqual(false);
        expect(item.dob).toBeInstanceOf(Date);

        // cache hit
        item = await compressedDataCache.wrap(UserModel)
            .findByPk(2);

        expect(item.id).toEqual(2);
        expect(item.name).toEqual('Alexa');
        expect(item.active).toEqual(false);
        expect(item.dob).toBeInstanceOf(Date);

        // verify cache hit
        const cacheGet = await cacheClient.get(CACHE_NAME.concat("-compressed"),
            'model-cache:findByPk:UserModels:{\"where\":{\"id\":2}}');
        expect(cacheGet).toBeInstanceOf(CacheGet.Hit);



    });

    it("compression test cache misses", async () => {
        let compressedDataCache = await modelCacheFactory(
            MomentoClientGenerator.newInstance({
                configuration: Configurations.Laptop.latest(),
                credentialProvider: CredentialProvider.fromEnvironmentVariable({environmentVariableName: 'MOMENTO_API_KEY'}),
                defaultTtlSeconds: 60,
                modelCacheName: CACHE_NAME.concat("-compressed"),
                forceCreateCache: true
            }), {logger: LoggerFactory.createLogger({logLevel: 'debug'}),
                compressionType: CompressionType.ZLIB});

        // find

        let user = await compressedDataCache.wrap(UserModel).findOne({
            where: {
                // @ts-ignore
                name: 'Alaexa'
            }
        });
        expect(user).toEqual(null);
        // calling again for cache interaction
        user = await compressedDataCache.wrap(UserModel).findOne({
            where: {
                // @ts-ignore
                name: 'Alaexa'
            }
        });
        expect(user).toEqual(null);
        // count
        let ct = await compressedDataCache.wrap(UserModel).count({
            where: {
                // @ts-ignore
                name: 'Alaeaaaaaxa'
            }
        });
        expect(ct).toEqual(0);
        // calling again for cache interaction
        ct = await compressedDataCache.wrap(UserModel).count({
            where: {
                // @ts-ignore
                name: 'Alaeaaaaaxa'
            }
        });
        expect(ct).toEqual(0);
    });

    it("findAll sorted ASC returns both users cache hit and miss", async () => {
        const items = await defaultModelCache.wrap(UserModel).findAll(
            {
                        order: [
                            ['name', 'ASC'],
                        ],
                    }
        );
        // cache miss
        expect(items[1].id).toEqual(1);
        expect(items[1].name).toEqual('Taylor');
        expect(items[1].active).toEqual(true);
        expect(items[1].dob).toBeInstanceOf(Date);
        expect(items[0].id).toEqual(2);
        expect(items[0].name).toEqual('Alexa');
        expect(items[0].active).toEqual(false);
        expect(items[0].dob).toBeInstanceOf(Date);

        // verify cache has items -- cache hit
        const cacheGet = await cacheClient.get(CACHE_NAME, 'model-cache:findAll:UserModels:{\"order\":[[\"name\",\"ASC\"]]}');
        expect(cacheGet).toBeInstanceOf(CacheGet.Hit);

        const response = JSON.parse((cacheGet as CacheGet.Hit).valueString());
        for (let i = 0; i < response.length; i++) {
            expect(response[i].id).toEqual(items[i].id);
            expect(response[i].name).toEqual(items[i].name);
            expect(response[i].active).toEqual(items[i].active);
            expect(response[i].dob).toEqual(items[i].dob.toISOString());
        }
    });

    it("supports group by active and shows counts", async () => {

        const response = await defaultModelCache.wrap(UserModel).findAll({
            attributes: ['active', [sequelize.fn('COUNT', sequelize.col('id')), 'userCount']],
            group: ['active'],
            raw: true
        });

        expect(response[0].active).toEqual(0); // false
        expect(response[0].userCount).toEqual(1); // count of users
        expect(response[1].active).toEqual(1); // true
        expect(response[1].active).toEqual(1); // count of users

        // verify cache hit
        const cacheGet = await cacheClient.get(CACHE_NAME, 'model-cache:findAll:UserModels:{\"attributes\":[\"active\",[{\"fn\":\"COUNT\",\"args\":[{\"col\":\"id\"}]},\"userCount\"]],\"group\":[\"active\"],\"raw\":true}');
        expect(cacheGet).toBeInstanceOf(CacheGet.Hit);
    });

    it("supports include and join another table", async () => {

        const response = await defaultModelCache.wrap(UserGroupModel).findOne({
            include: [
                {
                    required: true,
                    attributes: [],
                    model: UserModel,
                    where: {
                        id: 1
                    }
                }
            ]
        });

        expect(response.id).toEqual(1);
        expect(response.group).toEqual('blue');

        // verify cache hit
        const cacheGet = await cacheClient.get(CACHE_NAME, 'model-cache:findOne:UserGroupModels:{\"include\":[{\"required\":true,\"attributes\":[],\"model\":\"UserModels\",\"where\":{\"id\":1}}]}');
        expect(cacheGet).toBeInstanceOf(CacheGet.Hit);
    });
});
