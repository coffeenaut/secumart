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

//Session tracks sign-in attempts and data access.
const sessionTracker = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
      timestamp({
        format: 'YYYY-MM-DD hh:mm A',
      }),
      align(),
      printf((info) => `[${info.timestamp}]: ${info.message}`)
    ),
    transports: [new winston.transports.File({
      filename: `logs/sessions.log`,
    })],
  });
app.use(uParse.urlencoded({extended: true}));
var corsOptions = {
    origin: [corsAccept],
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
    let userAuthorization = await AgentX.authenticateUser(credentials);
    if(userAuthorization) {
        let encryptedMessage = Toolkit.encrypt(userAuthorization)
        res.status(200).json({token: encryptedMessage})
    }
    else
        res.status(401).send("Login attempt failed.")
});
app.post('/addNewUser', async function(req, res){
    let dUser = Toolkit.decrypt(req.body.username);
    let dSecret = Toolkit.decrypt(req.body.passphrase);
    let dRoles = Toolkit.decrypt(req.body.roleAccess);
    let 
    newUser = {
        username: dUser,
        secret: dSecret,
        roles: dRoles
    }
    let authToken = await AgentX.addUser(newUser)
    if(authToken)
        res.status(200).send("User added successfully")
    else
        res.status(200).send(`An error occurred`)
});
app.post('/checkUserPermissions', async function(req, res){
    let userToken = Toolkit.decrypt(req.body.authToken)
    let role = req.body.role
    let userPermitted = await AgentX.isUserPermitted(userToken, role)
    res.status(200).json(userPermitted)
});
/** Testing functions **/
app.get("/generateHash/", async (req, res) => {
    let response = Toolkit.generateToken();
    res.status(200).send(response);
});
app.listen(port, async () => {
    logger.info(`Process started for ${process.env.service_name} on ${port}`)
    console.log(`${process.env.service_name} listening on  ${port}`)
});
//graceful server shutdown request
app.post('/shutdownServerquit', async function (req, res) {
    res.status(200).send("Server shutdown initiated..")
    await AgentX.closeConnections()
    app.close();
});