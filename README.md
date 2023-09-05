# SecuMart

SecuMart is a simple encryption/decryption concept with [cryto-js](https://cryptojs.gitbook.io/docs/) AES hosted on [expressjs](https://github.com/expressjs/express). Sharing a private key between services and apps allows communcating sensitive data in the cloud. Extra security can be configured with CORS to allow origins from known sources. The service features a session-based authentication tokens that assigns permissive roles to users upon login. Data integrated with redis for speed, but can repackaged to connect with NOSQL or other document object stores.

![A process flow of AES between service and web app](/assets/sharedKeyCipher.drawio.png)

A vue app implentation wih SecuMart - [2dStatistics](https://github.com/coffeenaut/2dstatistics)

## Project setup
```
npm install
```

### Compiles and hot-reloads for development
```
npm run test
```
