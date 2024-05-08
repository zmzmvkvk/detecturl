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
const schedule = require('node-schedule');
const chatId = process.env.TELE_CHAT_ID;
const token = process.env.TELE_BOT_TOKEN;
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(token, { polling: true });
  
async function connectDatabase() {
    const client = await MongoClient.connect(dburl, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("DB연결성공");
    const db = client.db(dbName);
    const detections = await db.collection("detect").find({}).toArray();
    return detections.map(doc => ({ url: doc.url, buttonType: doc.buttonType, text: doc.text }));
}

async function detect(detections) {
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

// 

async function generate({ url, buttonType, text }, driver) {
    await driver.get(url);
    console.log("Page : " + await driver.getTitle());

    try {
        const button = await driver.wait(
            until.elementLocated(By.css(`${buttonType}`)),
            2000
        );
        if (await button.getText() == text) {
            console.log(`STATUS : SOLD OUT`);
        } else {
            console.log(`STATUS : AVAILABLE`);
            await bot.sendMessage(chatId, `재고 입고된듯 ${url}`);
        }
    } catch (error) {
        console.log("버튼명 맞지 않음 확인 필요.")
    }
}

connectDatabase().then(detections => {
    app.listen(PORT, async () => {
        console.log(`Server is running`);
        schedule.scheduleJob('*/1 * * * *', async function () {
            try {
                await detect(detections);
            } catch (error) {
                console.error("Error in detection process:", error);
            }
        })
    });
}).catch(err => {
    console.error("Database connection failed", err);
});
