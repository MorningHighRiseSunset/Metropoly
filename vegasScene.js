// Initialize scene, camera, and renderer
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Move camera up and back, and look slightly down at the model
camera.position.set(0, 28, 60); // Higher Y value for a top-down angle
camera.lookAt(0, 15, 0);        // Look at the center/top of the model

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1); // Black background
document.body.appendChild(renderer.domElement);

// Declare vegasModel globally to access it in other functions
let vegasModel;

// Load the Las Vegas model using GLTFLoader
const loader = new THREE.GLTFLoader();
loader.load(
    'Models/las_vegas/scene.gltf',
    (gltf) => {
        vegasModel = gltf.scene;
        vegasModel.scale.set(4, 4, 4); // Adjust scale as needed
        vegasModel.position.y = 12;    // Move the model up
        vegasModel.rotation.y = Math.PI; // Rotate 180 degrees
        scene.add(vegasModel);
    },
    undefined,
    (error) => {
        console.error('Error loading the GLTF model', error);
    }
);

// Ambient light for overall brightness
const ambientLight = new THREE.AmbientLight(0xbfdfff, 0.6); // Soft blue tint, moderate intensity
scene.add(ambientLight);

// Directional light to simulate sunlight
const sunLight = new THREE.DirectionalLight(0xfff5e1, 1.0); // Warm sunlight color
sunLight.position.set(100, 200, 100); // High position to simulate the sun
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.bias = -0.002;
scene.add(sunLight);

// Subtle fill light to reduce harsh shadows
const fillLight = new THREE.DirectionalLight(0xffffff, 0.4); // Neutral white light
fillLight.position.set(-50, 100, -50);
scene.add(fillLight);

// Point lights for subtle highlights
const pointLightIntensity = 0.3; // Lowered intensity for subtle highlights
const pointLights = [
    { pos: [0, 30, 0], color: 0xffffff },
    { pos: [30, 50, 30], color: 0xffffff },
    { pos: [-30, 50, 30], color: 0xffffff },
    { pos: [30, 50, -30], color: 0xffffff },
    { pos: [-30, 50, -30], color: 0xffffff },
];

pointLights.forEach((light) => {
    const pointLight = new THREE.PointLight(light.color, pointLightIntensity);
    pointLight.position.set(...light.pos);
    scene.add(pointLight);
});

// Mouse control variables
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

// Mouse control for left mouse button (M1)
document.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left mouse button
        isDragging = true;
    }
});

document.addEventListener('mousemove', (event) => {
    if (isDragging && vegasModel) {
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
        };

        const rotationSpeed = 0.005;
        vegasModel.rotation.y += deltaMove.x * rotationSpeed;
    }

    previousMousePosition = { x: event.clientX, y: event.clientY };
});

document.addEventListener('mouseup', (event) => {
    if (event.button === 0) { // Left mouse button
        isDragging = false;
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();

// Play button transition
document.getElementById('play-button').addEventListener('click', () => {
    document.body.style.transition = "opacity 0.5s";
    document.body.style.opacity = 0;
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 500);
});

function setVegasTokenInstructions() {
    window.vegasTokenInstructions =
        "Pick 2, 3, or 4 tokens to play. Tokens can be assigned to a human or AI player.\n" +
        "Single player: Select a token for Player One, then enable at least one AI token. Click 'Start Game' to begin.\n" +
        "For multiplayer: Click 'Enable PC' on any token to assign it to a computer.\n" +
        "Assign human or AI players to tokens for Players 2, 3, and 4 as needed.\n" +
        "Once 2 to 4 tokens are selected, click 'Start Game' to begin.";
}

function showVegasTokenInstructions() {
    // Remove existing instructions if present
    const existing = document.getElementById('vegas-token-instructions');
    if (existing) existing.remove();

    // Find the play button
    const playButton = document.getElementById('play-button');
    if (!playButton) return;

    // Get play button position
    const rect = playButton.getBoundingClientRect();

    // Create and style the instructions element
    const instruction = document.createElement('div');
    instruction.id = 'vegas-token-instructions';
    instruction.style.position = 'absolute';
    instruction.style.left = `${rect.left + rect.width / 2}px`;
    instruction.style.top = `${rect.top - 140}px`; // 70px above the button
    instruction.style.transform = 'translateX(-50%)';
    instruction.style.background = 'rgba(40,40,40,0.95)';
    instruction.style.color = '#fff';
    instruction.style.padding = '18px 32px';
    instruction.style.borderRadius = '10px';
    instruction.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    instruction.style.fontSize = '17px';
    instruction.style.zIndex = '10001';
    instruction.style.whiteSpace = 'pre-line';
    instruction.textContent = window.vegasTokenInstructions || '';

    // Add to body
    document.body.appendChild(instruction);
}

// Call this after setting the instructions
setVegasTokenInstructions();
showVegasTokenInstructions();