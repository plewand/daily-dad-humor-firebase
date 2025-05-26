import axios from 'axios';
import * as admin from 'firebase-admin';


import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as functions from 'firebase-functions';



// Initialize Firebase Admin SDK.
// In a Firebase Functions environment, initializeApp() can be called without arguments
// to automatically discover the project configuration.
if (admin.apps.length === 0) {
    admin.initializeApp();
}


async function fetchJokeFromAzure(): Promise<any> {
    const response = await axios.get("https://daily-dad-humor3.azurewebsites.net/api/JokeOfDay");
    return response.data;
}

async function sendPushToTopic(joke: any, topic: string): Promise<void> {
    logger.info(`Attempting to send joke to topic: ${topic}`, { jokeContent: joke.content || joke });

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

    const message = {
        message: {
            topic: topic, // For HTTP v1, just the topic name, not /topics/
            notification: {
                title: 'Your Daily Joke!',
                body: 'Tap to reveal the punchline 😄'
            },
            data: {
                joke: joke.content || String(joke), // Ensure joke is a string if content is missing
                author: joke.author || '',
                category: joke.category || ''
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


export const sendHourlyJoke = onSchedule("0 * * * *", async () => {
    const hour = new Date().getHours();
    const topic = `daily-dad-humor-joke-${String(hour).padStart(2, '0')}`;

    try {
        const joke = await fetchJokeFromAzure();
        await sendPushToTopic(joke, topic);
        logger.info(`✅ Joke sent to topic ${topic}, joke: ${joke.content}`); // Using logger.info for consistency
    } catch (error) {
        logger.error('❌ Failed to fetch or send joke:', error); // Using logger.error
    }
});


export const testJokePush = functions.https.onRequest((req, res) => {
    new Promise(async () => {
        if (req.path === '/' || req.path === '/healthz') {            
            res.status(200).send('OK');
            return;
        }
        logger.info(`Http trigger test`);
        const topic = req.query.topic || 'joke-test';

        try {
            const joke = await fetchJokeFromAzure();
            await sendPushToTopic(joke, String(topic));
            res.status(200).send(`✅ Test joke sent to topic: ${topic}, joke: ${joke.content}`);
        } catch (error) {
            console.error('❌ Test push failed:', error);
            res.status(500).send('Failed to send joke');
        }
    }
    )
});