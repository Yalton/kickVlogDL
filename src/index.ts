import express from 'express';
import { Request, Response, NextFunction } from 'express';
import { exec } from 'child_process';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';


const app = express();
app.use(express.json());
app.use(express.static('public'));

interface QueueItem {
    req: Request;
    res: Response;
    next: NextFunction;
    downloadId: string;
}

interface DownloadStatus {
    status: 'queued' | 'processing' | 'completed' | 'error';
    downloadUrl?: string;
    message?: string;
}

let isProcessing = false;
let queue: QueueItem[] = [];
const downloads: Record<string, DownloadStatus> = {};
const port = 3000;

setInterval(cleanDownloadsFolder, 1000 * 60 * 60);  // Run once every hour




// The function that deletes files older than 12 hours
function cleanDownloadsFolder() {
    const folderPath = './public/downloads';
    const maxAge = 1000 * 60 * 60 * 8; // 12 hours in milliseconds

    console.log("Cleaning old Download files")
    fs.readdir(folderPath, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            const stats = fs.statSync(filePath);

            const age = Date.now() - stats.mtime.getTime();

            if (age > maxAge) {
                fs.unlink(filePath, err => {
                    if (err) throw err;
                    console.log(`Deleted file ${file} that was ${age / 1000 / 60 / 60} hours old.`);
                });
            }
        }
    });
}

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
        args: ['--no-sandbox'],
        headless: "new",
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

    const downloadId = currentItem.downloadId
    const { req, res } = currentItem;

    const { url, formatId } = req.body;

    let masterUrl = await getMasterM3U8Url(url); // Fetch the master.m3u8 URL

    if (!masterUrl) {
        downloads[downloadId].status = 'error';
        downloads[downloadId].message = 'Could not find master.m3u8 URL.';
        isProcessing = false;
        return;
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
            downloads[downloadId].status = 'error';
            downloads[downloadId].message = 'An error occurred while executing the command.';
            console.log(`Error: ${error.message}`);
        } else if (stderr) {
            downloads[downloadId].status = 'error';
            downloads[downloadId].message = 'An error occurred while executing the command.';
            console.log(`Stderr: ${stderr}`);
        } else {
            const downloadUrl = `${req.protocol}://${req.get('host')}/downloads/${filename}`;
            downloads[downloadId].status = 'completed';
            downloads[downloadId].downloadUrl = downloadUrl;
            console.log(`Excecution complete saved to ${filename}`);
        }

        isProcessing = false;
        processQueue();
    });
    console.log(`Excecution complete saved to ${filename}`)
}


app.post('/download', async (req, res, next) => {
    const downloadId = uuidv4();
    downloads[downloadId] = { status: 'queued' };
    queue.push({ req, res, next, downloadId });
    res.json({ downloadId });
    processQueue();
});

app.post('/formats', async (req, res) => {

    console.log("Gathering Formats for video")

    const { url } = req.body;

    let masterUrl = await getMasterM3U8Url(url); // Fetch the master.m3u8 URL

    // Validate and sanitize the URL here!

    exec(`./bin/yt-dlp -F ${masterUrl}`, (error, stdout, stderr) => {
        if (error || stderr) {
            res.status(500).json({ message: 'An error occurred while fetching the formats.' });
        } else {
            // Parse the stdout to extract the available formats
            const lines = stdout.split('\n');
            const start = lines.findIndex(line => line.startsWith('ID'));
            const formats = lines.slice(start + 2).filter(line => line.length > 0).map(line => {
                const id = line.split(' ')[0];
                const resolution = line.split(' ')[2];
                return { id, resolution };
            });
            res.json({ formats });
        }
    });
});

app.get('/queue-size', (req, res) => {
    res.json({ size: queue.length });
});

app.get('/status/:id', (req: Request, res: Response) => {
    const { id } = req.params;
    const downloadStatus = downloads[id];

    if (downloadStatus) {
        res.json(downloadStatus);
    } else {
        res.status(404).json({ message: 'Download not found.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

        // exec(command, (error, stdout, stderr) => {
        //     if (error) {
        //         console.log(`Error: ${error.message}`);
        //         res.status(500).json({ message: 'An error occurred while executing the command.' });
        //     } else if (stderr) {
        //         console.log(`Stderr: ${stderr}`);
        //         res.status(500).json({ message: 'An error occurred while executing the command.' });
        //     } else {
        //         const downloadUrl = `${req.protocol}://${req.get('host')}/downloads/${filename}`;
        //         res.json({ message: 'Command executed successfully.', output: stdout, downloadUrl });
        //     }



// async function processQueue() {
//     if (queue.length === 0 || isProcessing) {
//         return;
//     }

//     isProcessing = true;

    
//     const currentItem = queue.shift();

//     // Check if currentItem is not undefined
//     if (!currentItem) {
//         isProcessing = false;
//         return;
//     }

//     const downloadId = currentItem.downloadId
//     const { req, res } = currentItem;

//     const { url, formatId } = req.body;

//     let masterUrl = await getMasterM3U8Url(url); // Fetch the master.m3u8 URL

//     if (!masterUrl) {
//         downloads[downloadId].status = 'error';
//         downloads[downloadId].message = 'Could not find master.m3u8 URL.';
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
//             downloads[downloadId].status = 'error';
//             downloads[downloadId].message = 'An error occurred while executing the command.';
//             console.log(`Error: ${error.message}`);
//             res.status(500).json({ message: 'An error occurred while executing the command.' });
//         } else if (stderr) {
//             downloads[downloadId].status = 'error';
//             downloads[downloadId].message = 'An error occurred while executing the command.';
//             console.log(`Stderr: ${stderr}`);
//             res.status(500).json({ message: 'An error occurred while executing the command.' });
//         } else {
//             const downloadUrl = `${req.protocol}://${req.get('host')}/downloads/${filename}`;
//             downloads[downloadId].status = 'completed';
//             downloads[downloadId].downloadUrl = downloadUrl;
//             res.json({ message: 'Command executed successfully.', output: stdout, downloadUrl });
//         }



//         isProcessing = false;
//         processQueue();
//     });
//     console.log(`Excecution complete saved to ${filename}`)
// }