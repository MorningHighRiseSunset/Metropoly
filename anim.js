// Simulate a terminal download animation
function simulateDownload() {
    const frames = ['|', '/', '-', '\\']; // Animation frames
    let progress = 0; // Progress percentage
    let frameIndex = 0; // Current frame index

    console.clear();
    console.log("Starting download...");

    const interval = setInterval(() => {
        // Update progress and frame
        progress = (progress + Math.random() * 2) % 100; // Simulate progress
        frameIndex = (frameIndex + 1) % frames.length;

        // Display the animation
        console.clear();
        console.log(`Downloading... ${frames[frameIndex]} ${progress.toFixed(2)}%`);

        // Simulate infinite download
        if (progress >= 99.99) {
            progress = 0; // Reset progress to loop forever
        }
    }, 100); // Update every 100ms
}

// Run the simulation
simulateDownload();