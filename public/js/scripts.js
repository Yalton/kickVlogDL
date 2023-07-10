async function getFormats() {
    const urlInput = document.querySelector('#url');
    const url = urlInput.value;
    const getFormatsButton = document.querySelector('#getFormatsButton');

    // Create a loading spinner element
    const loadingSpinner = document.createElement('div');
    loadingSpinner.classList.add('spinner'); // Add class for styling (in CSS)
    loadingSpinner.innerText = ''; // Or add an image/gif

    const form = document.querySelector('form');

    // Replace the Get Formats button with the loading spinner
    form.replaceChild(loadingSpinner, getFormatsButton);

    const response = await fetch('/formats', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
    });

    if (!response.ok) {
        console.error('An error occurred while fetching the formats.');
    } else {
        const data = await response.json();
        const formatSelect = document.querySelector('#formatId');
        formatSelect.innerHTML = ''; // Remove existing options

        data.formats.forEach(({ id, resolution }) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = id + " (" + resolution + ")";
            formatSelect.appendChild(option);
        });

        document.querySelector('.download-button').style.display = 'none'; // Initially hide the download button
    }

    // Replace the loading spinner with the Get Formats button
    form.replaceChild(getFormatsButton, loadingSpinner);
}

// async function downloadVideo(event) {
//     event.preventDefault();

//     const urlInput = document.querySelector('#url');
//     const formatIdInput = document.querySelector('#formatId');
//     const downloadButton = document.querySelector('.download-button');

//     const url = urlInput.value;
//     const formatId = formatIdInput.value;

//     // Need to Validate and sanitize the input

//     // Create a loading spinner element
//     const loadingSpinner = document.createElement('div');
//     loadingSpinner.classList.add('spinner'); // Add class for styling (in CSS)
//     loadingSpinner.innerText = ''; // Or add an image/gif

//     const form = document.querySelector('form');

//     // Replace the download button with the loading spinner
//     form.replaceChild(loadingSpinner, downloadButton);

//     const response = await fetch('/download', {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ url, formatId }),
//     });

//     if (!response.ok) {
//         console.error('An error occurred while downloading the video.');
//     } else {
//         const data = await response.json();
//         console.log(data);

//         // Provide a download link
//         const downloadLink = document.createElement('a');
//         downloadLink.href = data.downloadUrl;
//         downloadLink.innerText = 'View Video';
//         downloadLink.classList.add('button-link');  // Add a class to the download link for styling

//         // Replace the loading spinner with the download link
//         form.replaceChild(downloadLink, loadingSpinner);

//         // Clear the resolution options
//         formatIdInput.innerHTML = '';
//     }

//     urlInput.value = '';
//     formatIdInput.value = '';
// }
async function downloadVideo(event) {
    event.preventDefault();

    const urlInput = document.querySelector('#url');
    const formatIdInput = document.querySelector('#formatId');
    const downloadButton = document.querySelector('.download-button');

    const url = urlInput.value;
    const formatId = formatIdInput.value;

    const loadingSpinner = document.createElement('div');
    loadingSpinner.classList.add('spinner');
    loadingSpinner.innerText = '';

    const form = document.querySelector('form');

    form.replaceChild(loadingSpinner, downloadButton);

    const response = await fetch('/download', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, formatId }),
    });

    if (!response.ok) {
        console.error('An error occurred while downloading the video.');
    } else {
        const data = await response.json();
        const downloadId = data.downloadId;

        // Start polling for the download status
        checkDownloadStatus(downloadId, loadingSpinner, downloadButton);
    }

    urlInput.value = '';
    formatIdInput.value = '';
}

async function checkDownloadStatus(downloadId, loadingSpinner, downloadButton) {
    const response = await fetch(`/status/${downloadId}`);

    if (!response.ok) {
        console.error('An error occurred while checking the download status.');
    } else {
        const status = await response.json();

        // Check if the download is completed
        if (status.status === 'completed') {
            const downloadLink = document.createElement('a');
            downloadLink.href = status.downloadUrl;
            downloadLink.innerText = 'View Video';
            downloadLink.classList.add('button-link');  // Add a class to the download link for styling

            // Replace the loading spinner with the download link
            form.replaceChild(downloadLink, loadingSpinner);
        } else if (status.status === 'error') {
            console.error(status.message);
            form.replaceChild(downloadButton, loadingSpinner);
        } else {
            // If the download is still in progress, poll again in a few seconds
            setTimeout(() => checkDownloadStatus(downloadId, loadingSpinner, downloadButton), 5000);
        }
    }
}

async function fetchQueueSize() {
    const response = await fetch('/queue-size');
    const data = await response.json();
    return data.size;
}

document.addEventListener('DOMContentLoaded', () => {
    const queueSizeElement = document.getElementById('queue-size');

    setInterval(async () => {
        if (queueSizeElement) {
            const size = await fetchQueueSize();
            queueSizeElement.textContent = `Queue size: ${size}`;
        }
    }, 5000);
});

// A function to show the download button when a format is selected
function showDownloadButton() {
    const formatIdInput = document.querySelector('#formatId');
    if (formatIdInput.value) {  // Only show the button if a format is selected
        document.querySelector('.download-button').style.display = 'block'; // Show the download button
    }
}
