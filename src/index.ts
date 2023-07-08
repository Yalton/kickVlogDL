import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { exec } from 'child_process';
import puppeteer from 'puppeteer';
import axios from 'axios';


const app = express();
app.use(express.json());
app.use(express.static('public'));

interface QueueItem {
    req: Request;
    res: Response;
    next: NextFunction;
  }
  
  let queue: QueueItem[] = [];


const getMasterM3U8Url = async (url: string) => {
    // Extract video id from url
    console.log("Extracting Master URL")
    const videoId = url.split('/').pop();
  
    // Construct API url
    const apiUrl = `https://kick.com/api/v1/video/${videoId}`;
    console.log(`API URL: https://kick.com/api/v1/video/${videoId}`)

    // Start Puppeteer
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium',
        headless: "new"
    });
    
    const page = await browser.newPage();
    await page.goto(apiUrl, { waitUntil: 'networkidle0' });
    
    // Get the page content
    const bodyHandle = await page.$('body');
    if (bodyHandle === null) {
        throw new Error('body not found');
    }
    const rawJson = await page.evaluate(body => body.textContent, bodyHandle);
    await bodyHandle.dispose();
  
    if (rawJson === null) {
        throw new Error('body not found');
    }

    // Parse the page content as JSON
    const json = JSON.parse(rawJson);
  
    // Get master url from response
    const masterUrl = json.source;

    console.log(`MASTER URL: ${masterUrl}`)
  
    await browser.close();
  
    return masterUrl;
  };


app.post('/download', async (req, res, next) => {
    queue.push({ req, res, next });
    processQueue();
});

let isProcessing = false;

async function processQueue() {
    if (queue.length === 0 || isProcessing) {
        return;
    }

    isProcessing = true;

    const currentItem = queue.shift();

    // Check if currentItem is not undefined
    if (!currentItem) {
        isProcessing = false;
        return;
    }

    const { req, res } = currentItem;

    const { url, formatId } = req.body;

    // Validate and sanitize the URL and formatId here!

    let masterUrl = await getMasterM3U8Url(url); // Fetch the master.m3u8 URL

    if (!masterUrl) {
        return res.status(500).json({ message: 'Could not find master.m3u8 URL.' });
    }

    const filename = `${Date.now()}.mp4`;
    let command = `./bin/yt-dlp `;
    if (formatId) {
        command += `-f ${formatId} `;
    }
    command += `-o ./public/downloads/${filename} --external-downloader aria2c --external-downloader-args "aria2c:-x 16 -k 1M" ${masterUrl}`;

    console.log(`Executing ${command}`)

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log(`Error: ${error.message}`);
            res.status(500).json({ message: 'An error occurred while executing the command.' });
        } else if (stderr) {
            console.log(`Stderr: ${stderr}`);
            res.status(500).json({ message: 'An error occurred while executing the command.' });
        } else {
            const downloadUrl = `${req.protocol}://${req.get('host')}/downloads/${filename}`;
            res.json({ message: 'Command executed successfully.', output: stdout, downloadUrl });
        }

        isProcessing = false;
        processQueue();
    });
}


// app.post('/download', async (req, res) => { // make your route handler async
//     const { url, formatId } = req.body;

//     // Validate and sanitize the URL and formatId here!

//     let masterUrl = await getMasterM3U8Url(url); // Fetch the master.m3u8 URL

//     if (!masterUrl) {
//         return res.status(500).json({ message: 'Could not find master.m3u8 URL.' });
//     }

//     const filename = `${Date.now()}.mp4`;
//     let command = `./bin/yt-dlp `;
//     if (formatId) {
//         command += `-f ${formatId} `;
//     }
//     command += `-o ./public/downloads/${filename} --external-downloader aria2c --external-downloader-args "aria2c:-x 16 -k 1M" ${masterUrl}`;

//     console.log(`Executing ${command}`)
//     exec(command, (error, stdout, stderr) => {
//         if (error) {
//             console.log(`Error: ${error.message}`);
//             return res.status(500).json({ message: 'An error occurred while executing the command.' });
//         }
//         if (stderr) {
//             console.log(`Stderr: ${stderr}`);
//             return res.status(500).json({ message: 'An error occurred while executing the command.' });
//         }

//         const downloadUrl = `${req.protocol}://${req.get('host')}/downloads/${filename}`;
//         res.json({ message: 'Command executed successfully.', output: stdout, downloadUrl });
//     });
// });


const port = 3000;

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

