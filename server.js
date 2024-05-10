require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const { Builder, Capabilities, By, until } = require("selenium-webdriver");
const chrome = require('selenium-webdriver/chrome');
const app = express();
const dbUser = process.env.DB_USER;
const dbPassword = encodeURIComponent(process.env.DB_PASSWORD);
const dbName = "richlab";
const PORT = process.env.PORT || 3000;
const dburl = `mongodb+srv://${dbUser}:${dbPassword}@cluster0.xseitpb.mongodb.net/`;
const chatId = process.env.TELE_CHAT_ID;
const chatId2 = process.env.TELE_CHAT_ID_SH;
const token = process.env.TELE_BOT_TOKEN;
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(token, {
    polling: true, request: {
        agentOptions: {
            keepAlive: true,
            family: 4
        }
    }
});

let db;
let detections = [];

async function connectDatabase() {
    const client = await MongoClient.connect(dburl);
    console.log("DB연결성공");
    db = client.db(dbName);
    detections = await fetchDetections();
    watchDatabaseChanges();  // Change Streams 시작
}

async function fetchDetections() {
    return db.collection("detect").find({}).toArray().then(results => {
        return results.map(doc => ({ url: doc.url, buttonType: doc.buttonType, text: doc.text }));
    });
}

function watchDatabaseChanges() {
    const changeStream = db.collection('detect').watch();
    changeStream.on('change', async (change) => {
        console.log('Detected change:', change);
        detections = await fetchDetections(); // 데이터 최신화
    });
}

async function detect() {
    let options = new chrome.Options()
        .addArguments(
            "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "accept-language=ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "headless",
            "no-sandbox",
            "disable-gpu",
            "disable-dev-shm-usage",
            "disable-software-rasterizer",
            "window-size=1920x1080",
            "--user-data-dir=/tmp/chrome_user_data",
            "--data-path=/tmp/data-path",
            "--homedir=/tmp",
            "--disk-cache-dir=/tmp/cache-dir"
        );

    let driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    try {
        await driver.executeScript("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})");
        for (const detection of detections) {
            await generate(detection, driver);
        }
    } catch (error) {
        console.error("Error during detection:", error);
    } finally {
        await driver.quit();
    }
}

async function generate({ url, buttonType, text }, driver) {
    await driver.get(url);
    console.log("Page : " + await driver.getTitle());

    try {
        const button = await driver.wait(until.elementLocated(By.css(`${buttonType}`)), 2000);
        if (await button.getText() == text) {
            console.log(`STATUS : SOLD OUT`);
            console.log(`url = ${url}`);
        } else {
            console.log(`STATUS : AVAILABLE`);
            console.log(`url = ${url}`);
            await bot.sendMessage(chatId, `재고 입고됨
            상품명 : ${await driver.getTitle()}
            url : ${url}`);
            await bot.sendMessage(chatId2, `재고 입고됨
            상품명 : ${await driver.getTitle()}
            url : ${url}`);
        }
    } catch (error) {
        console.log("Error processing request:", error);
    }
}

connectDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        // 주기적 검사는 Change Streams로 대체됩니다.
    });
}).catch(err => {
    console.error("Database connection failed", err);
});
