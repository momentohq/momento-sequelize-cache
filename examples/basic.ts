import {Sequelize, DataTypes} from 'sequelize';
import {CacheClient, Configurations, CreateCache, CredentialProvider, DeleteCache} from "@gomomento/sdk";
import { MomentoClientGenerator } from "@gomomento-poc/momento-sequelize-cache";
import { LoggerFactory } from "@gomomento-poc/momento-sequelize-cache";
import { modelCacheFactory } from "@gomomento-poc/momento-sequelize-cache";

const sequelize = new Sequelize({ dialect: 'sqlite'});

const userSchema = {
    username: {
        type: DataTypes.STRING,
    },
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    birthday: DataTypes.DATE,
    age: DataTypes.INTEGER,
    isActive: DataTypes.BOOLEAN,
    accountBalance: DataTypes.FLOAT,
};

const User = sequelize.define('User', userSchema);

const userGroupSchema = {group: DataTypes.STRING,
    UserId: {
        type: DataTypes.INTEGER,
        references: {
            model: User,
            key: 'id'
        }
    }
};

const UserGroup = sequelize.define("UserGroup", userGroupSchema);

// we create the 1-to-1 association here between users and groups
UserGroup.belongsTo(User, { foreignKey: 'UserId' });


async function insertUser(username: string, birthday: Date, age: number, isActive: boolean, accountBalance: number) {
    await User.create({ username, birthday, age, isActive, accountBalance });
}

async function insertUserInGroup(UserId: number, group: string) {
    await UserGroup.create({ UserId, group });
}

async function doWork() {

    const client = await CacheClient.create({
        configuration: Configurations.Laptop.latest(),
        credentialProvider: CredentialProvider.fromEnvironmentVariable({environmentVariableName: 'MOMENTO_API_KEY'}),
        defaultTtlSeconds: 60,
    });

    await createCaches(client);

    await User.sync({force: true});
    await UserGroup.sync({force: true});

    const username = 'user2';
    const birthday = new Date(Date.UTC(1992, 5, 21));
    const age = 29;
    const isActive = true;
    const accountBalance = 70.07;

    // prepare the data; in real world these will happen elsewhere and we will be employing this project
    // primarily as a read-aside cache
    await insertUser(username, birthday, age, isActive, accountBalance);
    await insertUserInGroup(1, "yellow");
    await insertUser('user3', birthday, age, isActive, accountBalance);
    await insertUserInGroup(2, "green");
    await insertUser('user20', birthday, age, isActive, accountBalance);
    await insertUserInGroup(3, "green");

    // prepare momento model cache client
    const momentoClient = MomentoClientGenerator.getInstance({
        configuration: Configurations.Laptop.latest(),
        credentialProvider: CredentialProvider.fromEnvironmentVariable({environmentVariableName: 'MOMENTO_API_KEY'}),
        defaultTtlSeconds: 60,
    });

    const log = LoggerFactory.createLogger({ logLevel: 'debug' })
    const momentoSequelizeClient = await modelCacheFactory(momentoClient, log);

    log.debug({ userId : 1 }, "Issuing a read for one user findByPk")
    const userFindPK = await momentoSequelizeClient.wrap(User).findByPk(1, {raw: true});
    log.debug({details: userFindPK}, "Found user: ");
    log.debug({birthday: userFindPK.birthday}, "User birthday: ");

    if (userFindPK) {
        try {
            await userFindPK.save();
        } catch (error) {
            if (error instanceof TypeError) {
                log.debug({message: error.message}, 'Expected TypeError');
            } else {
                throw error;
            }
        }
    }


    log.debug({userName: 'Bob'}, "Issuing a read for one user findOne")

    const UserFindOneInGroup = await momentoSequelizeClient.wrap(UserGroup).findOne({
        include: [
            {
                required: true,
                attributes: [],
                model: User,
                where: {
                    id: 1
                }
            }
        ]
    });

    log.debug({user: JSON.stringify(UserFindOneInGroup)}, "Found user: ");

    const UserFindAll = await momentoSequelizeClient.wrap(User).findAll();
    log.debug({user: JSON.stringify(UserFindAll)}, "Found user: ");

    await deleteCaches(client);
}

async function createCaches(client: CacheClient) {
    const createUsers = await client.createCache('Users');
    if (createUsers instanceof CreateCache.Error) {
        throw new Error("Error creating cache Users " + createUsers.message())
    }
    const createUserGroups = await client.createCache('UserGroups');
    if (createUserGroups instanceof CreateCache.Error) {
        throw new Error("Error creating cache UserGroups " + createUserGroups.message())
    }
}

async function deleteCaches(client: CacheClient) {
    const deleteUsers = await client.deleteCache('Users');
    if (deleteUsers instanceof DeleteCache.Error) {
        throw new Error("Error creating cache Users " + deleteUsers.message());
    }
    const deleteUserGroups = await client.deleteCache('UserGroups');
    if (deleteUserGroups instanceof DeleteCache.Error) {
        throw new Error("Error creating cache UserGroups " + deleteUserGroups.message());
    }
}

doWork().catch(console.error);
