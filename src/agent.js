/**Agent worker authorizes and distributes security tasks */
const fs = require('fs');
const tokenFile = './data/tokens.json'
const tokenData = require('../data/tokens.json');
const Toolkit = require('./toolbox.js')
const winston = require('winston');
const redisClient = require('../data/connect-redis.js')
const { combine, timestamp, printf, align } = winston.format;
const fileDataPath =  require(`../data/${process.env.app_map_data_file}`)

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({
      format: 'YYYY-MM-DD hh:mm:ss.SSS A',
    }),
    align(),
    printf((info) => `[${info.timestamp}] ${info.level}: ${info.message}`)
  ),
  transports: [new winston.transports.File({
    filename: `logs/agent-${new Date().toISOString().split('T')[0]}.log`,
  })],
});
const client = redisClient.client
async () => { await client.connect()}
//live permissions are the systems current permission sets
async function addLivePermission(permission, userKey) {
    let result = null
    try {
        const redis_role = `roles:${permission}`
        result = await client.sAdd(redis_role, {userKey});
    }
    catch(error) {
        logger.error(`Error adding permssion for user ${redis_role}: ${error}`)
    }
    
    return result;
}
async function removeLivePermission(permission, userKey) {
    let result = null
    try {
        redis_role = `roles:${permission}`
        result = await client.sRem(redis_role, {userKey});
    }
    catch(error) {
        logger.error(`Error removing permissions for user ${redis_role}: ${error}`)
    }
    return result;
}
//Functions as update user as well
async function addUser(userObject) {
    let result = null
    try {
        let userId = `user:${userObject.username}`;
        let nAuthKey = Toolkit.generateToken();
        let newUser = userObject;
        newUser.authkey = nAuthKey;
        result = await client.hSet(userId, newUser);
    }
    catch(error) {
        logger.error(`Error adding/updating new user: ${error}`)
    }
    
    return result;
}
async function getKeyValues(key, value) {
    let result = null
    try {
        result = await client.hGet(key, value);
    }
    catch(error) {
        logger.error(`Error occurred getting key value pair: ${error}`)
    }
    return result
}
async function loginUser(loginInfo) {
    let userId = `user:${loginInfo.username}`
    let userKey = null
    try{
        const userObj = await client.hGetAll(userId);
        if(userObj) {
            if(loginInfo.secret === userObj.secret) {
                if(userObj.authkey)
                    userKey =  userObj.authkey
                else {//auth key doesn't exist 
                    let nKey = Toolkit.generateToken();
                    await client.hSet(userId, {authkey: nKey})
                    userKey =  nKey;
                }
                //Grant system permissions
                let roles = JSON.parse(userObj.roles)
                for(const role of roles) {
                    await addLivePermission(`role:${role}`, userKey)
                }
            }
        }
    }
    catch(e) {
        logger.error(`Error with user login: ${e}`)
    }
    return userKey
}
async function logoutUser(userToken) {
    let validSession = false
    try {
        let userId = `user:${user}`
        let systemRoles = await client.sMembers("system:roles")
        for (const sRole of systemRoles) {
            await removeLivePermission(sRole, userToken)
        }
        validSession = await client.sIsMember("sessions", usersToken)
    }
    catch(error) {
        logger.error(error)
    }
    return validSession

}
async function getUserToken(user) {
    let userToken = null
    try {
        let userId = `user:${user}`
        userToken = await client.hGet(userId, "authkey");
    }
    catch(error) {
        logger.error(error)
    }
    return userToken;
}
// true if user's token matches valid session
async function isUserAuthenticated(usersToken) {
    let validSession = false
    try {
        let userId = `user:${user}`
        validSession = await client.sIsMember("sessions", usersToken)
    }
    catch(error) {
        logger.error(error)
    }
    return validSession
    
}
async function isUserPermitted(userToken, permission) {
    let permitted = false
    try {
        permitted = await client.sIsMember(`role:${permission}`, userToken)
    }
    catch(error) {
        logger.error(error)
    }
    return permitted
    
}
function updateUserToken(currentToken, nToken, appId) {
    let refreshData = tokenData;
    for(let i in refreshData) {
        if(refreshData[i].applicationID === appId) {
            for(let t in refreshData[i].tokens) {
                logger.info(`Updating users for matching record- ${refreshData[i].tokens[t].username}`)
                if(refreshData[i].tokens[t].cToken === currentToken) {
                    refreshData[i].tokens[t].pToken = refreshData[i].tokens[t].cToken; //current token is now stale
                    refreshData[i].tokens[t].cToken = nToken
                    logger.info(`Token updated ${refreshData[i].tokens[t].cToken}`)
                    break; //exit token loop
                }
            }
            break; //exit loop if appId found
        }
    }
    fs.writeFileSync(tokenFile, JSON.stringify(refreshData, null, 2), function(error) {
        if(error)
            logger.error(error)
    })
}
function updateUserRecord(uRecord, tokenId, appId) {
    let recordUpdated = false
    let appData = getAppData(appId);
    let currentTokens = appData.data;
    let updateTokenId = parseInt(tokenId);
    //new item case
    if(updateTokenId > currentTokens.length-1)
        currentTokens.push({}) //add a new record to array
    
    try {
        logger.info(`exisiting record at ${currentTokens[updateTokenId].url}`)
        // currentTokens[updateTokenId] = uRecord
        currentTokens[updateTokenId].url = uRecord.url;
        currentTokens[updateTokenId].username = uRecord.username;
        currentTokens[updateTokenId].password = uRecord.password;
        currentTokens[updateTokenId].domain = uRecord.domain;
        currentTokens[updateTokenId].category = uRecord.category;
        logger.info(`bout to write`)
        fs.writeFileSync(getDataFile(appData.appFile), JSON.stringify(currentTokens, null, 2), function(error) {
            if(error) {
                logger.error(error)
                throw error
            }   
        })
        recordUpdated = true
        logger.info(`Updated record ${uRecord.domain} with values: ${JSON.stringify(uRecord)}`)
    }
    catch(error) {
        logger.info(`Error occurred: ${error}`)
    }
    return recordUpdated
}
async function deleteUserRecord(user) {
    let result = null
    try {
        await client.connect();
        let userId= `user:${user}`
        result = await client.del(userId);
    }
    catch(error) {
        logger.error(`Error adding new user: ${error}`)
    }  
    return result;
}
async function closeConnections() {
    await client.quit()
}
module.exports = {loginUser, getUserToken, isUserAuthenticated, isUserPermitted, updateUserToken, addUser, addLivePermission, removeLivePermission, closeConnections}
