/** checkpoint area where clients make requests and guard worker forwards request to appropriate
 * worker **/
const express = require("express")
const cors = require("cors")
const uParse = require("body-parser")
const app = express()
let dotenv = require('dotenv').config()
const winston = require('winston');
const { combine, timestamp, printf, align } = winston.format;
const AgentX = require ('./agent.js')
const Toolkit = require('./toolbox.js')

const port = process.env.port
const corsAccept = process.env.cors_accept

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
    filename: `logs/guard-${new Date().toISOString().split('T')[0]}.log`,
  })],
});
app.use(uParse.urlencoded({extended: true}));
var corsOptions = {
    origin: "*",
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    optionsSuccessStatus: 204
  }
app.use(cors(corsOptions))
app.use(express.json())
app.post('/signIn', async function(req, res){
    let dUser = Toolkit.decrypt(req.body.username);
    let dSecret = Toolkit.decrypt(req.body.passphrase);
    credentials = {
        username : dUser,
        secret: dSecret
    };
    let userAuthorization = await AgentX.loginUser(credentials);
    if(userAuthorization) {
        let encryptedMessage = Toolkit.encrypt(userAuthorization)
        res.status(200).json(encryptedMessage)
    }
    else
        res.status(401).send("Login attempt failed.")
})
app.post('/signOut', async function(req, res){
    let userKey = Toolkit.decrypt(req.body.authToken);
    let logoutStatus = await  AgentX.logoutUser(userKey);
    if(logoutStatus)
        res.status(200).send("You have been logged out.")
})
// app.post('/addNewUser', async function(req, res){
//     let dUser = Toolkit.decrypt(req.body.username);
//     let dSecret = Toolkit.decrypt(req.body.passphrase);
//     let dRoles = Toolkit.decrypt(req.body.roleAccess);
//     let 
//     newUser = {
//         username: dUser,
//         secret: dSecret,
//         roles: dRoles
//     }
//     let authToken = await AgentX.addUser(newUser)
//     if(authToken)
//         res.status(200).send("User added successfully")
//     else
//         res.status(200).send(`An error occurred`)
// });
app.post('/checkUserPermissions', async function(req, res){
    let userToken = Toolkit.decrypt(req.body.authToken)
    let role = req.body.role
    let userPermitted = await AgentX.isUserPermitted(userToken, role)
    res.status(200).json(userPermitted)
});
app.post('/validateSession', async function (req, res) {
    let userToken = Toolkit.decrypt(req.body.authToken)
    let validSession = await AgentX.isUserAuthenticated(userToken)
    res.status(200).json({isValid: validSession}) 
});
app.post('/authorizeSystemAdmin', async function (req, res) {
    let userToken = Toolkit.decrypt(req.body.authToken)
    let isAdmin = await AgentX.isUserPermitted(userToken, "administrator")
    res.status(200).json({isValid: isAdmin}) 
});
app.post('/getUserList', async function (req, res) {
    let userToken = Toolkit.decrypt(req.body.authToken)

    //check if admin priviledges
    let isPermitted = AgentX.isUserPermitted(userToken, "administrator")
    if(isPermitted) {
        let uList = await AgentX.getUserList()
        if(uList)
            res.status(200).json(uList) 
    }
    else {
        res.status(401).send("Authorized personnel only")
    }
        
});
app.post('/saveUserField', async function (req, res) {
    let userToken = Toolkit.decrypt(req.body.authToken)
    let isAdmin = await AgentX.isUserPermitted(userToken, "administrator")
    let status = false
    if(isAdmin) {
        let username = Toolkit.decrypt(req.body.username)
        let encryptedObj = req.body.obj
        let userObj = {}
        userObj.secret = Toolkit.decrypt(encryptedObj.secret)
        userObj.authkey = Toolkit.decrypt(encryptedObj.authkey)
        userObj.roles = encryptedObj.roles
        status = await AgentX.addUser(username, userObj)
        
    }
    res.status(200).json({saveStatus: status}) 
});
app.post('/addNewUser', async function (req, res) {
    let userToken = Toolkit.decrypt(req.body.authToken)
    let isAdmin = await AgentX.isUserPermitted(userToken, "administrator")
    let status = false
    if(isAdmin) {
        let username = Toolkit.decrypt(req.body.username)
        //check if user exists
        let userExists = await AgentX.usernameExists(username)
        if(!userExists) {
            AgentX.addUsername(username)
            let encryptedObj = req.body.obj
            let userObj = {}
            userObj.secret = Toolkit.decrypt(encryptedObj.secret)
            userObj.authkey = Toolkit.decrypt(encryptedObj.authkey)
            userObj.roles = encryptedObj.roles
            status = await AgentX.addUser(username, userObj)
        }
    }
    res.status(200).json({saveStatus: status}) 
});
app.post('/deleteUser', async function (req, res) {
    let userToken = Toolkit.decrypt(req.body.authToken)
    let isAdmin = await AgentX.isUserPermitted(userToken, "administrator")
    let status = false
    if(isAdmin) {
        let username = Toolkit.decrypt(req.body.username)
        AgentX.removeUsername(username)
        status = await AgentX.deleteUser(username)
    }
    res.status(200).json({saveStatus: status}) 
});
app.get("/encrypt/:encryptme", async (req, res) => {
    let response = Toolkit.encrypt(req.params.encryptme);
    res.status(200).send(response);
});
app.listen(port, async () => {
    logger.info(`Process started for ${process.env.service_name} on ${port}`)
    console.log(`${process.env.service_name} listening on  ${port}`)
});
//graceful server shutdown request
app.get('/shutdownServerquit', async function (req, res) {
    res.status(200).send("Server shutdown initiated..")
    await AgentX.closeConnections()
    app.close();
});