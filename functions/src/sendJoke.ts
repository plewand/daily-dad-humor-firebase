import axios from 'axios';
import * as admin from 'firebase-admin';


import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as functions from 'firebase-functions';
import { Joke, JokeList } from './joke';


// Initialize Firebase Admin SDK.
// In a Firebase Functions environment, initializeApp() can be called without arguments
// to automatically discover the project configuration.
if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}


async function fetchJokeFromAzure(): Promise<JokeList> {
    const response = await axios.get("https://daily-dad-humor3.azurewebsites.net/api/JokesForNotificatiion");
    return response.data as JokeList;
}

async function sendPushToTopic(jokes: Array<Joke>, topic: string): Promise<void> {

    logger.info(`Attempting to send joke to topic: [${topic}]`, { jokes: JSON.stringify(jokes) });

    const projectId = process.env.GCLOUD_PROJECT;
    if (!projectId) {
        logger.error("GCLOUD_PROJECT environment variable is not set.");
        throw new Error("Project ID not found. Cannot send FCM message.");
    }

    const accessToken = (await admin.credential.applicationDefault().getAccessToken()).access_token;
    if (!accessToken) {
        logger.error("Failed to retrieve OAuth2 access token.");
        throw new Error("Failed to retrieve OAuth2 access token.");
    }

    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    // const hours24 = 86400;
    // const minutes10 = 600;
    //const ttl = hours24 - minutes10

    //todo: remove
    const ttl = 60;

    const apnsExpiration = getApnsExpiration(ttl);


    const jokesData = jokes.length == 1 ? {
        content1: removeUnsupportedChars(jokes[0].content) || "",
        author1: removeUnsupportedChars(jokes[0].author || ''),
        jokeId1: jokes[0].jokeId || '',
        explanation1: jokes[0].explanation || '',
        rating1: `${jokes[0].rating || 0}`,
    } : {
        content1: removeUnsupportedChars(jokes[0].content) || "",
        author1: removeUnsupportedChars(jokes[0].author || ''),
        jokeId1: jokes[0].jokeId || '',
        explanation1: jokes[0].explanation || '',
        rating1: `${jokes[0].rating || 0}`,

        content2: jokes[1].content || "",
        author2: jokes[1].author || '',
        jokeId2: jokes[1].jokeId || '',
        explanation2: jokes[1].explanation || '',
        rating2: `${jokes[1].rating || 0}`,
    };

    const message = {
        message: {
            topic: topic, // For HTTP v1, just the topic name, not /topics/
            notification: {
                title: 'Your Daily Joke!',
                body: 'Tap to reveal'
            },
            data: jokesData,
            "android": {
                "ttl": `${ttl}s`  // ✅ TTL for Android (24 hours)
            },
            "apns": {
                "headers": {
                    "apns-expiration": `${apnsExpiration}`  // ✅ UNIX timestamp (seconds)
                }
            }
        }
    };

    await axios.post(fcmEndpoint, message, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        }
    });
    logger.info(`Successfully sent push notification to topic: ${topic}`);
}

function removeUnsupportedChars(text: string): string {
    return text.normalize('NFKD').replace(/[^\x00-\x7F]/g, '');
}

function getApnsExpiration(ttlInSeconds: number): string {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return String(nowInSeconds + ttlInSeconds);
}

export const sendHourlyJoke = onSchedule("0 * * * *", async () => {
    try {
        const jokeList = await fetchJokeFromAzure();
        await processJokeList(jokeList);
        logger.info(`✅ Jokes sent to topics`); // Using logger.info for consistency
    } catch (error) {
        logger.error('❌ Failed to fetch or send joke:', error); // Using logger.error
    }
});

async function processJokeList(jokeList: JokeList): Promise<void> {
    const promises = new Array<Promise<void>>();
    const now = new Date(Date.now() + 25_000); // add 25 seconds
    const hour = now.getHours();
    const hourPart = String(hour).padStart(2, '0');

    for (const topicInfo of jokeList.topics) {
        const standardJoke = jokeList.standardJokes[topicInfo.stdJokeIndex];
        const premiumJoke = jokeList.premiumJokes[topicInfo.premiumJokeIndex];
        const stdTopicName = `${topicInfo.topicName}-${hourPart}-standard-test`;
        const premTopicName = `${topicInfo.topicName}-${hourPart}-premium-test`;

        promises.push(sendPushToTopic([standardJoke.joke], stdTopicName));
        promises.push(sendPushToTopic([premiumJoke.joke, standardJoke.joke], premTopicName));
    }

    await Promise.all(promises);
}

export const testJokePush = functions.https.onRequest((req, res) => {
    new Promise(async () => {
        if (req.path === '/' || req.path === '/healthz') {
            res.status(200).send('OK');
            return;
        }
        logger.info(`Http trigger test`);
        try {
            const jokeList = await fetchJokeFromAzure();
            processJokeList(jokeList);
            logger.info(`✅ Jokes sent to topics`); // Using logger.info for consistency
        } catch (error) {
            logger.error('❌ Failed to fetch or send joke:', error); // Using logger.error
        }
    });
});