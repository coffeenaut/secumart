/**Agent worker authorizes and distributes security tasks */
const Toolkit = require('./toolbox.js')
const winston = require('winston');
const Redis = require('ioredis');
const { combine, timestamp, printf, align } = winston.format;

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
const client = new Redis({
    username: process.env.REDIS_USER,
    password: process.env.REDIS_NOT_PASSWORD,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    tls: true,
});
//live permissions are the systems current permission sets
async function addLivePermission(permission, userKey) {
    let result = null

    try {
        const redis_role = `roles:${permission}`
        result = await client.sadd(redis_role, {userKey});
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
        result = await client.srem(redis_role, {userKey});
    }
    catch(error) {
        logger.error(`Error removing permissions for user ${redis_role}: ${error}`)
    }
    
    return result;
}
//Functions as update user as well
async function addUser(username, userObject) {
    let result = null
    try {
        let userId = `user:${username}`
        let newUser = userObject;
        if(!userObject.authkey) 
            newUser.authkey = Toolkit.generateToken();
        let changed = await client.hset(userId, newUser);
        result = changed > 0

        //ensure username in system
    }
    catch(error) {
        logger.error(`Error adding/updating new user: ${error}`)
    }
    return result
}
async function loginUser(loginInfo) {
    let userId = `user:${loginInfo.username}`
    let userKey = null
    try{
        const userObj = await client.hgetall(userId);
        if(userObj) {
            if(loginInfo.secret === userObj.secret) {
                if(userObj.authkey)
                    userKey =  userObj.authkey
                else {//auth key doesn't exist 
                    let nKey = Toolkit.generateToken();
                    await client.hset(userId, {authkey: nKey})
                    userKey =  nKey;
                }
                // Grant system permissions
                let roles = userObj.roles.split(',')
                for(const role of roles) {
                    logger.info(`Adding role ${role} to system for user ${userId}`)
                    await addLivePermission(`role:${role}`, userKey)
                }
                //Add user to active sessions
                logger.info(`Enabling session for user ${userId}`)
                await client.sadd("system:sessions", userKey);
            }
        }
    }
    catch(e) {
        logger.error(`Error with user login: ${e}`)
    }
    return userKey
}
//Sessions always remain open until user signs out
async function logoutUser(userToken) {
    let status = false
    try {
        let userId = `user:${user}`
        let systemRoles = await client.smembers("system:roles")
        for (const sRole of systemRoles) {
            await removeLivePermission(sRole, userToken)
        }
        await client.srem("system:sessions", {userKey});
        status = true
    }
    catch(error) {
        logger.error(error)
    }
    return status

}
// Validates if the session is still active.
async function isUserAuthenticated(usersToken) {
    let validSession = false
    try {
        validSession = await client.sismember("system:sessions", usersToken)
    }
    catch(error) {
        logger.error(`redis.SISMEMBER sessions error: ${error}`)
    }
    
    return validSession
}
async function isUserPermitted(userToken, permission) {
let permitted = false
    try {
        permitted = await client.sismember(`roles:${permission}`, userToken)
    }
    catch(error) {
        logger.error(`redis.SISMEMBER permission check ${error}`)
    }
    
    return permitted
}
async function usernameExists(username) {
    let exists = false
    try {
        exists = await client.sismember('system:usernames', username)
    }
    catch(error) {
        logger.error(`redis.SISMEMBER user exists ${error}`)
    }
    
    return exists
}
async function addUsername(username) {
    let status = false
    try {
        let results = await client.sadd('system:usernames', username)
        status = results > 0
    }
    catch(error) {
        logger.error(`redis.sadd new user to system ${error}`)
    }
    
    return status
}
async function deleteUser(username) {
    let status = false
    try {
        let userId= `user:${username}`
        result = await client.del(userId);
        status = result > 0
    }
    catch(error) {
        logger.error(`Error adding new user: ${error}`)
    }  
    return status;
}
async function getAllMembers(key) {
    let members = []
    try {
        members = await client.smembers(key);
    }
    catch(error) {
        logger.error(`Error adding new user: ${error}`)
    }  
    return members;
}
async function getUserList() {
    let users = []
    try {
        let members = await getAllMembers("system:usernames")
        for(const member of members) {
            let user = await client.hgetall(`user:${member}`)
            user.name = member
            users.push(user)
        }
    }
    catch(error) {
        logger.error(`Error getting user list: ${error}`)
    }
    return users;
}
async function removeUsername(username) {
    let status = false
    try {
        await client.srem("system:usernames", username)
        status = true
    }
    catch(error) {
        logger.error(`Error adding new user: ${error}`)
    }
    return status
}
module.exports = {
    loginUser,
    logoutUser,
    deleteUser,
    getUserList,
    isUserAuthenticated,
    isUserPermitted,
    addUser,
    addUsername,
    usernameExists,
    removeUsername,
    addLivePermission,
    removeLivePermission,
}

