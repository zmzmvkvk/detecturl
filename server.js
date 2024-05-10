require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const { Builder, By, until } = require("selenium-webdriver");
const chrome = require('selenium-webdriver/chrome');
const app = express();
const dbUser = process.env.DB_USER;
const dbPassword = encodeURIComponent(process.env.DB_PASSWORD);
const dbName = "richlab";
const PORT = process.env.PORT || 3000;
const dburl = `mongodb+srv://${dbUser}:${dbPassword}@cluster0.xseitpb.mongodb.net/`;
const schedule = require('node-schedule');
const chatId = process.env.TELE_CHAT_ID;
const chatId2 = process.env.TELE_CHAT_ID_SH;
const token = process.env.TELE_BOT_TOKEN;
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(token, {
    polling: true,
    request: {
        agentOptions: {
            keepAlive: true,
            family: 4
        }
    }
});
let db, driver;

async function connectDatabase() {
    const client = await MongoClient.connect(dburl);
    console.log("DB연결성공");
    db = client.db(dbName);
    await initDriver();
    scheduleJob();
}

async function initDriver() {
    driver = await new Builder().forBrowser('chrome').setChromeOptions(new chrome.Options()
        .addArguments(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "accept-language=ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "headless",
            "no-sandbox",
            "disable-gpu",
            "window-size=1920x1080"
        )).build();
}

async function scheduleJob() {
    schedule.scheduleJob('*/1 * * * *', async function () {
        const detections = await fetchDetections();
        for (const detection of detections) {
            await generate(detection);
        }
    });
}

async function fetchDetections() {
    return db.collection("detect").find({}).toArray().then(results => {
        return results.map(doc => ({ url: doc.url, buttonType: doc.buttonType, text: doc.text }));
    });
}

async function generate({ url, buttonType, text }) {
    try {
        await driver.get(url);
        const button = await driver.wait(until.elementLocated(By.css(buttonType)), 2000);
        const buttonText = await button.getText();
        if (buttonText === text) {
            console.log(`STATUS : SOLD OUT for ${url}`);
        } else {
            console.log(`STATUS : AVAILABLE for ${url}`);
            await bot.sendMessage(chatId, `재고 입고된듯 ${url}`);
            await bot.sendMessage(chatId2, `재고 입고된듯 ${url}`);
        }
    } catch (error) {
        console.log(`Error processing ${url}: ${error}`);
    }
}

connectDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
    bot.onText(/\/add (.+)/, async (msg, match) => {
        const msgchatId = msg.chat.id;
        const resp = match[1];
    
        console.log(resp);
        console.log(`chatId = ${msgchatId}`);
        try {
            await db.collection("detect").insertOne({ url: resp });
        } catch (e) {
            console.log(e);
        }
        
        bot.sendMessage(msgchatId, `${resp}가 db에 저장되었습니다.`);
    });
}).catch(err => {
    console.error("Database connection failed", err);
});
