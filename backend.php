<?php

// This could come from user input, but be sure to sanitize and validate it!
$url = 'PASTE YOUR URL HERE';

// Command to download video
$command1 = 'yt-dlp -o vod.mp4 --external-downloader aria2c --external-downloader-args "aria2c:-x 16 -k 1M" ' . escapeshellarg($url);
$output1 = shell_exec($command1);

// Command to get available formats
$command2 = 'yt-dlp -F ' . escapeshellarg($url);
$output2 = shell_exec($command2);

// Display the output of the commands
echo "Output of the download command: $output1<br>";
echo "Output of the format command: $output2<br>";

?>
