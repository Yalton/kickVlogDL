import express from 'express';
import { exec } from 'child_process';

const app = express();
app.use(express.json());

app.post('/download', (req, res) => {
    const { url, formatId } = req.body;

    // Validate and sanitize the URL and formatId here!

    let command = `yt-dlp `;
    if (formatId) {
        command += `-f ${formatId} `;
    }
    command += `-o vod.mp4 --external-downloader aria2c --external-downloader-args "aria2c:-x 16 -k 1M" ${url}`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.log(`Error: ${error.message}`);
            return res.status(500).json({ message: 'An error occurred while executing the command.' });
        }
        if (stderr) {
            console.log(`Stderr: ${stderr}`);
            return res.status(500).json({ message: 'An error occurred while executing the command.' });
        }

        res.json({ message: 'Command executed successfully.', output: stdout });
    });
});

const port = 3000;

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
