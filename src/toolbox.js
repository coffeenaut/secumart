const crypto = require('crypto-js')
let dotenv = require('dotenv').config()
const secret =  process.env.NOT_A_SECRET

const generateRandomString = (length=6)=>Math.random().toString(20).substring(2, length)
const getNewHash = (hashme) => (crypto.SHA256(hashme).toString(crypto.enc.Hex))
const generateToken = () => (getNewHash(generateRandomString(8)))
function decrypt (encrypted){return crypto.AES.decrypt(encrypted, secret).toString(crypto.enc.Utf8)}
function encrypt(rawData) {return crypto.AES.encrypt(rawData, secret).toString()}

module.exports = {generateRandomString, generateToken, decrypt, encrypt}