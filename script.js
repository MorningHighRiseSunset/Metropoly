import * as THREE from '../libs/three.module.js';
import {
    GLTFLoader
} from '../libs/GLTFLoader.js';
import {
    OrbitControls
} from '../libs/OrbitControls.js';
import {
    TextGeometry
} from '../libs/TextGeometry.js';
import {
    FontLoader
} from '../libs/FontLoader.js';

// Initialize the GLTFLoader
const loader = new GLTFLoader();

// Register the KHR_materials_pbrSpecularGlossiness extension
loader.register((parser) => new GLTFMaterialsPbrSpecularGlossinessExtension(parser));

let camera, scene, renderer, controls;
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta(); // Use a clock to get the time delta

    // Update all animation mixers
    scene.traverse((object) => {
        if (object.userData.idleMixer) {
            object.userData.idleMixer.update(delta);
        }
        if (object.userData.walkMixer) {
            object.userData.walkMixer.update(delta);
        }
    });

    // Update the follow camera if active
    if (isFollowingToken && selectedToken) {
        updateFollowCamera(selectedToken);
    }

    controls.update();
    renderer.render(scene, isFollowingToken ? followCamera : camera); // Render with the active camera
}

let editMode = false;
let aiPlayers = new Set();
let initialSelectionComplete = false;
let humanPlayerCount = 0;
let allowedToRoll = true;
let diceContainer = null;
let aiPlayerIndices = [];
let lastPlayerIndex = -1;
let isTokenMoving = false;
let idleModel, walkModel;
let idleMixer, walkMixer;
let currentAnimation = null;
let isTurnInProgress = false;
let followCamera; // Secondary camera for following tokens
let isFollowingToken = false; // Flag to track if the follow camera is active
let hasTakenAction = false; // Tracks if the player has taken an action
let hasDrawnCard = false; // Global flag to track card drawing
let hasRolledDice = false; // Tracks if the dice have been rolled
let hasMovedToken = false; // Tracks if the token has been moved
let hasHandledProperty = false; // Tracks if the property has been handled
let isAIProcessing = false;
let turnCounter = 0;

// Initialize audio with proper settings
let accelerationSound = new Audio('');
accelerationSound.preload = 'auto';
accelerationSound.load();

window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

const images = [
    "Images/p-las-vegas-motor-speedway_55_660x440_201404181828.webp", // Grand Prix
    "https://s3-us-west-1.amazonaws.com/exr-static/upload/vegassupercars/off_road/track_overview/gallery/SV_OFF_ROAD_TRACK_GALLERY_7.jpg", // Speed Vegas Off Roading
    "Images/230613231941-04-knights-stanley-cup-061323.jpg", // Las Vegas Golden Knights
    // Las Vegas Monorail
    "Images/702-helicopters.webp", // Maverick Helicopter Rides
    // Brothel
    "Images/693695_050215-ap-mayweather-img.jpg",
    "Images/Screenshot 2024-12-12 033702.png", 
    "",// Brothel
    "Images/1.png", // Luxury Tax
    // Bellagio
    "Images/11929141633_b4ab5fd45e_k.webp", // Horseback Riding
    "Images/raidersimage.png", // Las Vegas Raiders
    "https://s.abcnews.com/images/Sports/las-vegas-aces-gty-thg-180808_hpMain_16x9_992.jpg", // Las Vegas Aces
    "", // Resorts World Theatre
    "Images/themirage.jpg", // Mirage
    "Images/unnamed.png",
    "Images/berry1.webp", // Nascar
    "https://upload.wikimedia.org/wikipedia/commons/c/c1/Wynn_2_%282%29.jpg", // Wynn Las Vegas
    "Images/unnamed (1).png",
    "https://shrinerschildrensopen.com/wp-content/uploads/2022/10/ShrinersChildrens-18-hole-2022.jpg", // Shriners Children's Open
    "Images/thesphere.jpg", // Sphere
    "Images/welcome-to-caesars-palace.jpg", // Caesars Palace
    "Images/hq720.jpg"
    // Santa Fe Hotel and Casino
    // House of Blues
    // Cosmopolitan
];

const positions = [{
        x: 32.4,
        y: 1.5,
        z: 32.4
    }, // GO (Bottom Right Corner)
    {
        x: 25.2,
        y: 1.5,
        z: 32.4
    },
    {
        x: 18,
        y: 1.5,
        z: 32.4
    },
    {
        x: 10.8,
        y: 1.5,
        z: 32.4
    },
    {
        x: 3.6,
        y: 1.5,
        z: 32.4
    },
    {
        x: -3.6,
        y: 1.5,
        z: 32.4
    },
    {
        x: -10.8,
        y: 1.5,
        z: 32.4
    },
    {
        x: -18,
        y: 1.5,
        z: 32.4
    },
    {
        x: -25.2,
        y: 1.5,
        z: 32.4
    },
    {
        x: -32.4,
        y: 1.5,
        z: 32.4
    }, // JAIL (Bottom Left Corner)

    {
        x: -32.4,
        y: 1.5,
        z: 25.2
    },
    {
        x: -32.4,
        y: 1.5,
        z: 18
    },
    {
        x: -32.4,
        y: 1.5,
        z: 10.8
    },
    {
        x: -32.4,
        y: 1.5,
        z: 3.6
    },
    {
        x: -32.4,
        y: 1.5,
        z: -3.6
    },
    {
        x: -32.4,
        y: 1.5,
        z: -10.8
    },
    {
        x: -32.4,
        y: 1.5,
        z: -18
    },
    {
        x: -32.4,
        y: 1.5,
        z: -25.2
    },
    {
        x: -32.4,
        y: 1.5,
        z: -32.4
    }, // FREE PARKING (Top Left Corner)

    {
        x: -25.2,
        y: 1.5,
        z: -32.4
    },
    {
        x: -18,
        y: 1.5,
        z: -32.4
    },
    {
        x: -10.8,
        y: 1.5,
        z: -32.4
    },
    {
        x: -3.6,
        y: 1.5,
        z: -32.4
    },
    {
        x: 3.6,
        y: 1.5,
        z: -32.4
    },
    {
        x: 10.8,
        y: 1.5,
        z: -32.4
    },
    {
        x: 18,
        y: 1.5,
        z: -32.4
    },
    {
        x: 25.2,
        y: 1.5,
        z: -32.4
    },
    {
        x: 32.4,
        y: 1.5,
        z: -32.4
    }, // GO TO JAIL (Top Right Corner)

    {
        x: 32.4,
        y: 1.5,
        z: -25.2
    },
    {
        x: 32.4,
        y: 1.5,
        z: -18
    },
    {
        x: 32.4,
        y: 1.5,
        z: -10.8
    },
    {
        x: 32.4,
        y: 1.5,
        z: -3.6
    },
    {
        x: 32.4,
        y: 1.5,
        z: 3.6
    },
    {
        x: 32.4,
        y: 1.5,
        z: 10.8
    },
    {
        x: 32.4,
        y: 1.5,
        z: 18
    },
    {
        x: 32.4,
        y: 1.5,
        z: 25.2
    }
];

const properties = [{
        name: "GO",
        type: "special",
        imageUrls: [],
        description: "Collect $200 as you pass GO!",
        special: true
    },
    {
        name: "Las Vegas Raiders",
        price: 100,
        rent: 10,
        owner: null,
        address: "",
        color: "brown",
        mortgageValue: 50,
        housePrice: 50,
        hotelPrice: 250,
        rentWithHouse: [50, 150, 450, 625],
        rentWithHotel: 750,
        videoUrls: [ "Videos/LVRaidersVid.mp4",

        ],
    },
    {
        name: "Community Cards",
        type: "special",
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
        description: "Draw a Community Card!",
        special: true
    },
    {
        name: "Las Vegas Grand Prix",
        price: 120,
        rent: 12,
        owner: null,
        address: "",
        color: "brown",
        mortgageValue: 60,
        housePrice: 50,
        hotelPrice: 250,
        rentWithHouse: [60, 180, 500, 700],
        rentWithHotel: 900,
        videoUrls: [ "Videos/LV Grand Prix.mp4",
        ],
    },
    {
    name: "Income Tax",
    type: "tax",
    price: 200,
    imageUrls: ["Images/Uncle-Sam-1.jpg"],
    description: "Pay Income Tax: $200 or 10% of your total worth",
    special: true
    },
    {
        name: "Las Vegas Monorail",
        price: 200,
        rent: 25,
        owner: null,
        type: "railroad",
        address: "",
        mortgageValue: 100,
        rentWithRailroads: [25, 50, 100, 200],
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "Speed Vegas Off Roading",
        price: 140,
        rent: 14,
        owner: null,
        address: "",
        color: "lightblue",
        mortgageValue: 70,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [70, 200, 550, 750],
        rentWithHotel: 950,
        videoUrls: [ "Videos/Offroading 1.mp4",

        ],
    },
    {
        name: "Chance",
        type: "special",
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
        description: "Draw a Chance card!",
        special: true
    },
    {
        name: "Las Vegas Golden Knights",
        price: 160,
        rent: 16,
        owner: null,
        address: "",
        color: "lightblue",
        mortgageValue: 80,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [80, 220, 600, 800],
        rentWithHotel: 1000,
        videoUrls: [ "Videos/LV Golden Knights.mp4",

        ],
    },
    {
        name: "JAIL",
        price: 100, // Example price for the property
        rent: 10, // Example rent for landing on it
        owner: null,
        address: "Jail Square",
        color: "gray", // Assign a color for the property
        mortgageValue: 50,
        description: "Pay rent if owned, or just visit if unowned.",
        videoUrls: [
        ]
    },
    {
        name: "Maverick Helicopter Rides",
        price: 220,
        rent: 22,
        owner: null,
        address: "",
        color: "pink",
        mortgageValue: 110,
        housePrice: 150,
        hotelPrice: 250,
        rentWithHouse: [110, 330, 800, 975],
        rentWithHotel: 1150,
        videoUrls: [ 
            "Videos/MavHeli 1.mp4",
            "Videos/MavHeli 2.mp4",
            "Videos/MavHeli 3.mp4",
        ],
    },
    {
        name: "Brothel",
        price: 150,
        rent: 15,
        owner: null,
        address: "",
        color: "pink",
        mortgageValue: 75,
        housePrice: 100,
        hotelPrice: 250,
        rentWithHouse: [75, 225, 675, 900],
        rentWithHotel: 1100,
        videoUrls: [ 
            "Videos/tapDancingWomen.mp4",
        ],
    },
    {
        name: "Electric Company",
        price: 150,
        rent: 0,
        owner: null,
        type: "utility",
        mortgageValue: 75,
        description: "If one utility is owned, rent is 4 times amount shown on dice. If both utilities are owned, rent is 10 times amount shown on dice.",
        imageUrls: "Images/yellow light bulb image.jpg",
    },
    {
        name: "Bet MGM",
        price: 280,
        rent: 28,
        owner: null,
        address: "",
        color: "pink",
        mortgageValue: 140,
        housePrice: 150,
        hotelPrice: 250,
        rentWithHouse: [150, 450, 1000, 1200],
        rentWithHotel: 1400,
        imageUrls: "Images/4PFVVBO_copyright_image_38478.jpg",
    },
    {
        name: "Bellagio",
        price: 300,
        rent: 30,
        owner: null,
        address: "",
        color: "orange",
        mortgageValue: 150,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [200, 600, 1400, 1700],
        rentWithHotel: 2000,
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "Community Cards",
        type: "special",
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
        description: "Draw a Community Card!",
        special: true
    },
    {
        name: "FREE PARKING",
        type: "special",
        imageUrls: "Images/free parking.jpg",
        description: "Take a break! No fee to park here.",
        special: true
    },
    {
        name: "Horseback Riding",
        price: 340,
        rent: 34,
        owner: null,
        address: "",
        color: "orange",
        mortgageValue: 170,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [220, 650, 1500, 1850],
        rentWithHotel: 2100,
        videoUrls: [ "Videos/horse6.mp4",

        ],
    },
    {
        name: "Chance",
        type: "special",
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
        description: "Draw a Chance card!",
        special: true
    },
    {
        name: "The Mirage",
        price: 400,
        rent: 40,
        owner: null,
        address: "",
        color: "red",
        mortgageValue: 200,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [250, 750, 1600, 1950],
        rentWithHotel: 2200,
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "Water Works",
        price: 150,
        rent: 0,
        owner: null,
        type: "utility",
        mortgageValue: 75,
        description: "If one utility is owned, rent is 4 times amount shown on dice. If both utilities are owned, rent is 10 times amount shown on dice.",
        imageUrls: "",
    },
    {
        name: "Sphere",
        price: 480,
        rent: 48,
        owner: null,
        address: "",
        color: "yellow",
        mortgageValue: 240,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [280, 850, 2000, 2200],
        rentWithHotel: 2400,
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "GO TO JAIL",
        type: "special",
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
        description: "Go directly to Jail. Do not pass GO. Do not collect $200.",
        special: true
    },
    {
        name: "Caesars Palace",
        price: 500,
        rent: 50,
        owner: null,
        address: "",
        color: "green",
        mortgageValue: 250,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [300, 900, 2200, 2400],
        rentWithHotel: 2600,
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "Santa Fe Hotel and Casino",
        price: 520,
        rent: 52,
        owner: null,
        address: "",
        color: "green",
        mortgageValue: 260,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [320, 950, 2300, 2500],
        rentWithHotel: 2700,
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "Chance",
        type: "special",
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
        description: "Draw a Chance card!",
        special: true
    },
    {
        name: "Luxury Tax",
        type: "tax",
        price: 75,
        imageUrls: "Images/luxuryTax.png",
        description: "Pay Luxury Tax of $75",
        special: true
    },
    {
        name: "House of Blues",
        price: 540,
        rent: 54,
        owner: null,
        address: "",
        color: "blue",
        mortgageValue: 270,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [330, 1000, 2400, 2600],
        rentWithHotel: 2800,
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "The Cosmopolitan",
        price: 560,
        rent: 56,
        owner: null,
        address: "",
        color: "blue",
        mortgageValue: 280,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [350, 1100, 2500, 2700],
        rentWithHotel: 3000,
        imageUrls: "unnamed.gif"
    },
    {
        name: "Community Cards",
        type: "special",
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
        description: "Draw a Community Card!",
        special: true
    },
    {
        name: "Las Vegas Aces",
        price: 320,
        rent: 32,
        owner: null,
        address: "",
        color: "orange",
        mortgageValue: 160,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [210, 625, 1450, 1750],
        rentWithHotel: 2050,
        videoUrls: [ 
            "Videos/WNBAHL1.mp4",
            "Videos/WNBAHL2.mp4",
            "Videos/WNBAHL3.mp4",
            "Videos/WNBAHL4.mp4",
        ],
    },
    {
        name: "Resorts World Theatre",
        price: 360,
        rent: 36,
        owner: null,
        address: "",
        color: "red",
        mortgageValue: 180,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [230, 700, 1500, 1850],
        rentWithHotel: 2100,
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "Wynn Las Vegas",
        price: 440,
        rent: 44,
        owner: null,
        address: "",
        color: "yellow",
        mortgageValue: 220,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [260, 800, 1900, 2100],
        rentWithHotel: 2300,
        videoUrls: [ // Changed from imageUrls to videoUrls for clarity

        ],
    },
    {
        name: "Shriners Children's Open",
        price: 460,
        rent: 46,
        owner: null,
        address: "",
        color: "yellow",
        mortgageValue: 230,
        housePrice: 200,
        hotelPrice: 250,
        rentWithHouse: [270, 825, 1950, 2150],
        rentWithHotel: 2350,
        videoUrls: [ 
            "Videos/Shriners 1.mp4",
            "Videos/Shriners 3.mp4",
            "Videos/Shriners 4.mp4",
        ],
    }
];


const placeNames = [
    "GO", // Corner 1
    "Las Vegas Raiders",
    "Community Cards", // First Community Cards
    "Las Vegas Grand Prix",
    "Income Tax", // Add Income Tax here
    "Las Vegas Monorail", // First railroad
    "Speed Vegas Off Roading",
    "Chance", // First Chance
    "Las Vegas Golden Knights",
    "JAIL", // Corner 2
    "Maverick Helicopter Rides",
    "Brothel",
    "Electric Company", // First utility
    "Bet MGM",
    "Las Vegas Monorail", // Second railroad
    "Bellagio",
    "Las Vegas Aces",
    "Community Cards", // Second Community Cards
    "FREE PARKING", // Corner 3
    "Horseback Riding",
    "Resorts World Theatre",
    "Chance", // Second Chance
    "The Mirage", // Changed from "Encore Theatre"
    "Wynn Las Vegas", // Changed from "South Point Casino" 
    "Shriners Children's Open", // Changed from "Golf Inst."
    "Sphere",
    "Community Cards", // Third Community Cards
    "GO TO JAIL", // Corner 4
    "Caesars Palace",
    "Santa Fe Hotel and Casino", // Changed from "Las Vegas Resort & Casino"
    "Chance", // Third Chance
    "Luxury Tax", // Add Luxury Tax here
    "House of Blues",
    "Water Works", // Second utility
    "The Cosmopolitan",
    "Community Cards", // Fourth Community Cards
];

const chanceCards = [
    "Move forward 3 spaces",
    "Go back three spaces",
    "Pay $100 for casino renovations", // Increased from $50
    "Collect $300 from a high roller tip", // Increased from $150
    "Your poker face pays off. Collect $150.", // Increased from $75
    "You win a slot machine jackpot. Collect $400.", // Increased from $200
    "Caught cheating at blackjack. Pay $200.", // Increased from $100
    "Casino loyalty program rewards you. Collect $200.", // Increased from $100
    "Your luck runs out. Pay $50.", // Increased from $25
    "Win a casino raffle. Collect $500.", // Increased from $250
    "Pay $200 for a VIP casino membership.", // Increased from $100
    "Collect $100 from each player for hosting a poker night.", // Increased from $50
    "Move forward 5 spaces.",
    "Your lucky day! Collect $600 from the casino.", // Increased from $300
    "Caught counting cards. Pay a $400 fine.", // Increased from $200
    "Win a high-stakes poker game. Collect $1,000.", // Increased from $500
    "Pay $150 for a luxury spa treatment.", // Increased from $75
    "Win a blackjack tournament. Collect $500.", // Increased from $250
    "Caught speeding on the Strip. Pay a $200 fine.", // Increased from $50
    "Your investments pay off. Collect $800." // Increased from $400
];

const communityChestCards = [
    "Advance to GO. Collect $400.", // Increased from $200
    "Get Out of Jail Free - Keep this card until needed or sell it.",
    "Pay $100 for valet parking fees.", // Increased from $50
    "Collect $200 from a casino bonus.", // Increased from $100
    "You win Employee of the Month. Collect $100.", // Increased from $50
    "Pay $300 for a casino uniform upgrade.", // Increased from $150
    "Collect $500 from a casino jackpot.", // Increased from $200
    "Pay $200 for a gaming license renewal.", // Increased from $100
    "Collect $50 from valet parking tips.", // Increased from $25
    "Casino stocks are up. Collect $100.", // Increased from $50
    "Pay $80 per house and $150 per hotel for property maintenance.", // Increased from $40/$115
    "You find a lucky chip on the floor. Collect $50.", // Increased from $20
    "Casino holiday bonus. Collect $150.", // Increased from $75
    "Pay $100 for a casino marketing fee.", // Increased from $50
    "Win a casino poker tournament. Collect $300.", // Increased from $150
    "Casino appreciation day. Collect $50 from each player.", // Increased from $10
    "Caught using your phone at the blackjack table. Pay $100.", // Increased from $50
    "Pay $200 for a charity gala.", // Increased from $100
    "Collect $400 from a casino jackpot.", // Increased from $200
    "You win Employee of the Year. Collect $300.", // Increased from $150
    "Pay $100 for a parking violation.", // Increased from $50
    "Collect $50 from each player for hosting a casino night.", // Increased from $25
    "Move forward 3 spaces.",
    "Pay $80 per house and $150 per hotel for property maintenance.", // Increased from $40/$115
    "Collect $150 from a casino loyalty program.", // Increased from $75
    "You find a winning lottery ticket. Collect $1,000.", // Increased from $500
    "Pay $300 for a luxury suite upgrade.", // Increased from $150
    "Collect $200 for a successful business venture.", // Increased from $100
    "Pay $400 for a luxury shopping spree.", // Increased from $200
    "Your stocks rise. Collect $600.", // Increased from $300
    "Caught cheating at a poker game. Pay $200.", // Increased from $100
    "Advance to the Las Vegas Aces game. If you pass GO, collect $400.", // Increased from $200
    "Win a raffle at the casino. Collect $500.", // Increased from $250
    "Pay $150 for a fine dining experience.", // Increased from $75
    "Collect $100 for a lucky slot machine spin.", // Increased from $50
];

let enableXMovement = true;
let enableZMovement = true;

let propertyOptionsUI = null;
const loadingManager = new THREE.LoadingManager();
let currentPlayerIndex = 0;
const horizontalGridSize = 0.1;
const verticalGridSize = 0.5;
let draggedObject = null;
let offset = new THREE.Vector3();
let isMoving = false;
let imagePlaceholders = [];
let propertyPlaceholders = [];
let carouselPlaceholder;
let currentCarouselImage = 0;
let lastCarouselUpdate = 0;
let raycaster;
let mouse;
let popupGroup;
let isPopupVisible = false;
let readyBuffer;
let audioContext;
let selectedToken = null;
let currentPosition = 0;
let gameStarted = false;
let tokenSelectionUI = null;

let players = [{
        name: "Player 1",
        money: 1500,
        properties: [],
        selectedToken: null,
        currentPosition: 0
    },
    {
        name: "Player 2",
        money: 1500,
        properties: [],
        selectedToken: null,
        currentPosition: 0
    },
    {
        name: "Player 3",
        money: 1500,
        properties: [],
        selectedToken: null,
        currentPosition: 0
    },
    {
        name: "Player 4",
        money: 1500,
        properties: [],
        selectedToken: null,
        currentPosition: 0
    }
];

// filepath: c:\Users\DELL\Metropoly\script.js
let availableTokens = [
    {
        name: "hat",
        displayName: "Top Hat"
    },
    {
        name: "woman",
        displayName: "Woman"
    },
    {
        name: "rolls royce",
        displayName: "Rolls Royce"
    },
    {
        name: "speed boat",
        displayName: "Speed Boat"
    },
    {
        name: "football",
        displayName: "Football"
    },
    {
        name: "helicopter",
        displayName: "Helicopter"
    },
    {
        name: "burger",
        displayName: "Burger"
    },
    {
        name: "nike",
        displayName: "Tennis Shoe"
    }
];

function startTurn() {
    console.log(`Starting turn for Player ${currentPlayerIndex + 1} (${players[currentPlayerIndex].name})`);

    // Reset turn-related flags
    hasDrawnCard = false;

    // Reset property-specific flags
    properties.forEach(property => {
        property.hasBeenHandled = false;
    });

    const currentPlayer = players[currentPlayerIndex];
    if (currentPlayer.isAI) {
        executeAITurn(currentPlayer);
    } else {
        enableHumanTurn(currentPlayer);
    }
}

function toggleAI(token, button) {
    if (!initialSelectionComplete) {
        if (aiPlayers.has(token.name)) {
            // Remove from AI players
            aiPlayers.delete(token.name);
            const indexToRemove = aiPlayerIndices.findIndex(index =>
                players[index].tokenName === token.name
            );
            if (indexToRemove > -1) {
                aiPlayerIndices.splice(indexToRemove, 1);
            }
            button.textContent = "Click to Enable PC";
            button.classList.remove("active");
            button.parentElement.parentElement.querySelector(".ai-indicator").classList.remove("active");
        } else {
            if (humanPlayerCount + aiPlayers.size >= 4) {
                alert("Maximum 4 players allowed!");
                return;
            }

            // Calculate correct player index
            const aiPlayerIndex = humanPlayerCount + aiPlayers.size;

            // Validate player index
            if (aiPlayerIndex >= 4) {
                console.error("Invalid player index:", aiPlayerIndex);
                return;
            }

            console.log(`Setting up AI player ${aiPlayerIndex + 1} with token ${token.name}`);

            // Set up AI player
            const currentPlayer = players[aiPlayerIndex];
            currentPlayer.tokenName = token.name;
            currentPlayer.isAI = true;
            aiPlayerIndices.push(aiPlayerIndex);

            // Find and set up the token
            const selectedTokenObject = scene.children.find(obj => obj.userData.tokenName === token.name);
            if (selectedTokenObject) {
                selectedTokenObject.visible = true;
                selectedTokenObject.position.set(22.5, 2.5, 22.5);
                selectedTokenObject.userData.playerIndex = aiPlayerIndex;
                currentPlayer.selectedToken = selectedTokenObject;

                // Add highlight effect
                const highlightMaterial = new THREE.MeshPhongMaterial({
                    color: getPlayerColor(aiPlayerIndex),
                    transparent: true,
                    opacity: 0.3
                });

                const highlightGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 32);
                const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
                highlight.position.y = -0.5;
                highlight.userData.isHighlight = true;
                selectedTokenObject.add(highlight);
            }

            aiPlayers.add(token.name);
            button.textContent = "Click to Disable PC";
            button.classList.add("active");
            button.parentElement.parentElement.querySelector(".ai-indicator").classList.add("active");

            // Debug log
            console.log("AI Players after adding:", Array.from(aiPlayers));
            console.log("Player setup:", players.map((p, i) => ({
                index: i,
                tokenName: p.tokenName,
                isAI: p.isAI,
                hasToken: !!p.selectedToken
            })));
        }

        updateStartButtonVisibility();
    }
}

function updateStartButtonVisibility() {
    const startButton = tokenSelectionUI.querySelector('.action-button');
    const arrowUp = startButton.querySelector('.arrow-flash:nth-child(2)');
    const arrowDown = startButton.querySelector('.arrow-flash:nth-child(3)');
    const count = humanPlayerCount + aiPlayers.size;

    startButton.style.display = "block"; // Always show the button

    if (count >= 2 && count <= 4) {
        startButton.disabled = false;
        startButton.style.opacity = "1";
        startButton.classList.add("flash-active");
        if (arrowUp) arrowUp.style.display = "block";
        if (arrowDown) arrowDown.style.display = "block";
    } else {
        startButton.disabled = true;
        startButton.style.opacity = "0.7";
        startButton.classList.remove("flash-active");
        if (arrowUp) arrowUp.style.display = "none";
        if (arrowDown) arrowDown.style.display = "none";
    }
}

function validatePlayerTokens() {
    players.forEach((player, index) => {
        if (!player.selectedToken && player.tokenName) {
            const tokenObject = scene.children.find(obj =>
                obj.userData.tokenName === player.tokenName
            );
            if (tokenObject) {
                player.selectedToken = tokenObject;
                console.log(`Restored token for player ${index + 1}`);
            }
        }
    });
}

function handleAIPropertyDecision(property, callback = () => {}) {
    console.log("handleAIPropertyDecision called for property:", property);

    if (!property) {
        console.error("No property found for AI to handle.");
        callback();
        return;
    }

    const currentPlayer = players[currentPlayerIndex];
    console.log(`Current AI Player: ${currentPlayer.name}, Money: $${currentPlayer.money}`);

    // Check if the property has already been handled this turn
    if (property.hasBeenHandled) {
        console.log(`Property ${property.name} already handled this turn. Skipping.`);
        callback();
        return;
    }

    property.hasBeenHandled = true; // Mark the property as handled
    console.log(`Handling property: ${property.name}`);

    if (property.type === "special") {
        // Handle special properties
        switch (property.name) {
            case "Chance":
            case "Community Cards":
                if (hasDrawnCard) {
                    console.log("A card has already been drawn this turn. Skipping.");
                    callback();
                    return;
                }
                console.log(`AI drawing card from ${property.name}`);
                drawCard(property.name);
                hasDrawnCard = true; // Set the flag to prevent multiple draws
                setTimeout(callback, 1000);
                break;
            default:
                console.log(`AI landed on special space: ${property.name}`);
                setTimeout(callback, 1000);
        }
    } else if (!property.owner) {
        // Handle unowned properties
        const shouldBuy = makeAIBuyDecision(currentPlayer, property);
        console.log(`AI decision to buy ${property.name}: ${shouldBuy ? "Yes" : "No"}`);

        if (shouldBuy && currentPlayer.money >= property.price) {
            console.log(`AI decided to buy ${property.name}`);
            buyProperty(currentPlayer, property, callback);
        } else {
            console.log(`AI decided not to buy ${property.name}`);
            setTimeout(callback, 1000);
        }
    } else if (property.owner !== currentPlayer) {
        // Handle rent payment
        const rentAmount = calculateRent(property);
        console.log(`Property is owned by ${property.owner.name}. Rent is $${rentAmount}.`);

        if (currentPlayer.money >= rentAmount) {
            currentPlayer.money -= rentAmount;
            property.owner.money += rentAmount;
            console.log(`AI paid $${rentAmount} rent to ${property.owner.name}.`);
        } else {
            console.log(`AI cannot afford rent of $${rentAmount}.`);
            handleBankruptcy(currentPlayer, property.owner);
        }

        setTimeout(callback, 1000);
    } else {
        // Property is owned by the AI itself
        console.log(`AI landed on its own property: ${property.name}`);
        setTimeout(callback, 1000);
    }
}

function handleRentPayment(player, property) {
    if (!property || !property.owner) {
        console.error("Invalid property or owner for rent payment");
        return;
    }

    const rentAmount = calculateRent(property);
    
    if (player.money >= rentAmount) {
        player.money -= rentAmount;
        property.owner.money += rentAmount;
        
        // Log the rent payment
        console.log(`${player.name} paid $${rentAmount} rent to ${property.owner.name}`);
        showFeedback(`${player.name} paid $${rentAmount} rent to ${property.owner.name}`);
        
        updateMoneyDisplay();

        // Close any open property UI
        closePropertyUI();

        // End the turn after a short delay
        setTimeout(() => {
            isTurnInProgress = false;
            endTurn();
        }, 1500);
    } else {
        console.log(`${player.name} cannot afford rent of $${rentAmount}`);
        showFeedback(`${player.name} cannot afford rent of $${rentAmount}!`);
        handleBankruptcy(player, property.owner);
    }
}


function executeAITurn() {
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer.isAI) {
        console.error(`executeAITurn called for a non-AI player: Player ${currentPlayerIndex + 1}`);
        return;
    }

    console.log(`Executing AI turn for Player ${currentPlayerIndex + 1} (${currentPlayer.name})`);

    isTurnInProgress = true; // Mark the turn as in progress
    hasRolledDice = false; // Reset the flag for the new turn
    hasMovedToken = false;
    hasHandledProperty = false;
    isAIProcessing = true;

    // Check if AI is in jail first
    if (currentPlayer.inJail) {
        handleAIJailTurn(currentPlayer);
        return;
    }

    // Step 1: Roll the dice
    setTimeout(() => {
        console.log("AI rolling dice...");
        const roll1 = Math.ceil(Math.random() * 6);
        const roll2 = Math.ceil(Math.random() * 6);
        const diceRoll = roll1 + roll2;

        console.log(`AI rolled ${roll1} and ${roll2} (total: ${diceRoll})`);
        showDiceResult(diceRoll, roll1, roll2);
        hasRolledDice = true;

        // Step 2: Move the token
        moveTokenToNewPosition(diceRoll, () => {
            console.log(`AI finished moving to position ${currentPlayer.currentPosition}`);
            hasMovedToken = true;

            // Step 3: Handle the property or special space
            const propertyName = placeNames[currentPlayer.currentPosition];
            const property = properties.find(p => p.name === propertyName);

            if (property) {
                handleAIPropertyLanding(currentPlayer, property, () => {
                    console.log(`AI finished handling property: ${property.name}`);
                    hasHandledProperty = true;
                    checkAITurnCompletion();
                });
            } else {
                console.log(`AI landed on an unhandled space: ${propertyName}`);
                hasHandledProperty = true;
                checkAITurnCompletion();
            }
        });
    }, 1000);
}

function handleAIPropertyLanding(player, property, callback) {
    switch (property.name) {
        case "Chance":
            console.log("AI landed on Chance.");
            if (!hasDrawnCard) {
                drawCard("Chance");
                hasDrawnCard = true;
            }
            setTimeout(callback, 1500);
            break;

        case "Community Cards":
            console.log("AI landed on Community Cards.");
            if (!hasDrawnCard) {
                drawCard("Community Cards");
                hasDrawnCard = true;
            }
            setTimeout(callback, 1500);
            break;

        case "Income Tax":
            handleAIIncomeTax(player);
            setTimeout(callback, 1500);
            break;

        case "Luxury Tax":
            handleAILuxuryTax(player);
            setTimeout(callback, 1500);
            break;

        case "GO TO JAIL":
            console.log("AI landed on GO TO JAIL");
            goToJail(player);
            setTimeout(callback, 1500);
            break;

        case "JAIL":
            console.log("AI landed on Jail. Just visiting.");
            setTimeout(callback, 1500);
            break;

        case "FREE PARKING":
            console.log("AI landed on Free Parking");
            setTimeout(callback, 1500);
            break;

        default:
            handleAIPropertyDecision(property, callback);
    }
}

function checkAITurnCompletion() {
    console.log("AI Turn Flags:", {
        hasRolledDice,
        hasMovedToken,
        hasHandledProperty,
        hasDrawnCard,
        isTurnInProgress
    });

    if (hasRolledDice && hasMovedToken && hasHandledProperty) {
        setTimeout(() => {
            console.log(`AI turn completed for Player ${currentPlayerIndex + 1}`);
            isTurnInProgress = false;
            isAIProcessing = false;
            endTurn();
        }, 1000);
    } else {
        console.log("AI turn not yet complete. Waiting for all actions to finish.");
    }
}

function handleAIIncomeTax(player) {
    const totalWorth = calculatePlayerWorth(player);
    const tenPercent = Math.floor(totalWorth * 0.1);
    
    if (tenPercent < 200 && player.money >= tenPercent) {
        player.money -= tenPercent;
        showFeedback(`${player.name} paid $${tenPercent} (10%) in Income Tax`);
    } else if (player.money >= 200) {
        player.money -= 200;
        showFeedback(`${player.name} paid $200 in Income Tax`);
    } else {
        handleBankruptcy(player, null);
    }
    updateMoneyDisplay();
}

function handleAILuxuryTax(player) {
    if (player.money >= 75) {
        player.money -= 75;
        showFeedback(`${player.name} paid $75 in Luxury Tax`);
    } else {
        handleBankruptcy(player, null);
    }
    updateMoneyDisplay();
}

function calculatePlayerWorth(player) {
    let worth = player.money;
    player.properties.forEach(property => {
        worth += property.price || 0;
        worth += (property.houses || 0) * (property.housePrice || 0);
        worth += (property.hotel ? property.hotelPrice : 0);
    });
    return worth;
}

function makeAIPurchaseDecision(player, buyButton) {
    const propertyName = document.querySelector('.detail-value.name').textContent;
    const property = properties.find(p => p.name === propertyName);

    if (!property) {
        const closeButton = buyButton.parentElement.querySelector('.action-button.close');
        if (closeButton) closeButton.click();
        console.log("AI pressed the close button on the property UI.");
        setTimeout(() => endTurn(), 1000); // Ensure the turn ends
        return;
    }

    // Enhanced AI decision making
    const shouldBuy = (
        player.money >= property.price * 2 || // Buy if we have plenty of money
        property.price <= 200 || // Buy cheap properties
        hasMonopolyPotential(player, property) || // Buy if close to monopoly
        Math.random() > 0.3 // Random chance to buy
    );

    console.log(`AI deciding on ${property.name}: ${shouldBuy ? 'Buying' : 'Passing'}`);

    setTimeout(() => {
        if (shouldBuy) {
            console.log(`AI clicked the buy button for ${property.name}`);
            buyButton.click();
        } else {
            const closeButton = buyButton.parentElement.querySelector('.action-button.close');
            if (closeButton) {
                console.log("AI pressed the close button on the property UI.");
                closeButton.click();
            }
        }

        // End the turn after the decision
        setTimeout(() => endTurn(), 1000);
    }, 1000);
}

function initPlayerTokenSelection() {
    if (tokenSelectionUI && document.body.contains(tokenSelectionUI)) {
        document.body.removeChild(tokenSelectionUI);
    }
    createPlayerTokenSelectionUI(currentPlayerIndex);
}

// Edit mode functions
function toggleEditMode() {
    editMode = !editMode;
    console.log(`Edit mode: ${editMode ? 'ON' : 'OFF'}`);

    const editModeUI = document.getElementById('edit-mode-ui');
    if (editMode) {
        editModeUI.style.display = 'block';
        highlightProperties();
        controls.enabled = false;
    } else {
        editModeUI.style.display = 'none';
        resetPropertyColors();
        controls.enabled = true;
    }
}

function highlightProperties() {
    scene.traverse((object) => {
        if (object.userData.isProperty) {
            if (object.material) {
                const newMaterial = object.material.clone();
                newMaterial.color.setHex(0x00ff00);
                newMaterial.needsUpdate = true;
                object.material = newMaterial;
            }
        }
    });
}

function resetPropertyColors() {
    scene.traverse((object) => {
        if (object.userData.isProperty) {
            if (object.material) {
                const newMaterial = object.material.clone();
                newMaterial.color.setHex(0x888888);
                newMaterial.needsUpdate = true;
                object.material = newMaterial;
            }
        }
    });
}

// Mouse interaction functions
function onMouseDown(event) {
    if (!editMode) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const intersectedObject = intersects[0].object;
        if (intersectedObject.userData.isProperty) {
            draggedObject = intersectedObject;
            offset.copy(intersects[0].point).sub(draggedObject.position);
        }
    }
}

function onMouseUp() {
    if (draggedObject) {
        const finalPosition = `Position: x=${draggedObject.position.x.toFixed(3)}, y=${draggedObject.position.y.toFixed(3)}, z=${draggedObject.position.z.toFixed(3)}`;

        const positionBox = document.getElementById('final-position');
        positionBox.textContent = finalPosition;

        const copyButton = document.getElementById('copy-position-button');
        copyButton.onclick = () => {
            navigator.clipboard.writeText(finalPosition).then(() => {
                alert('Position copied to clipboard!');
            });
        };

        draggedObject = null;
    }
}

function showTokenSpinner(tokenName) {
    // Prevent duplicate spinners
    if (document.getElementById(`spinner-${tokenName}`)) return;

    const spinner = document.createElement('div');
    spinner.className = 'token-spinner';
    spinner.id = `spinner-${tokenName}`;
    spinner.innerHTML = `
        <div class="spinner"></div>
        <div style="font-size:13px;margin-top:8px">${tokenName.replace(/^\w/, c => c.toUpperCase())} loading...</div>
    `;
    spinner.style.position = 'fixed';
    spinner.style.top = '50%';
    spinner.style.left = '50%';
    spinner.style.transform = 'translate(-50%, -50%)';
    spinner.style.zIndex = 9999;
    spinner.style.background = 'rgba(30,30,30,0.92)';
    spinner.style.padding = '22px 36px';
    spinner.style.borderRadius = '12px';
    spinner.style.color = '#fff';
    spinner.style.textAlign = 'center';
    spinner.style.boxShadow = '0 4px 16px rgba(0,0,0,0.25)';
    document.body.appendChild(spinner);

    // Add spinner CSS if not present
    if (!document.getElementById('token-spinner-style')) {
        const style = document.createElement('style');
        style.id = 'token-spinner-style';
        style.textContent = `
        .spinner {
            border: 5px solid #eee;
            border-top: 5px solid #4caf50;
            border-radius: 50%;
            width: 38px;
            height: 38px;
            animation: spin 1s linear infinite;
            margin: 0 auto 8px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg);}
            100% { transform: rotate(360deg);}
        }
        `;
        document.head.appendChild(style);
    }
}

function hideTokenSpinner(tokenName) {
    const spinner = document.getElementById(`spinner-${tokenName}`);
    if (spinner) spinner.remove();
}

// 2. Replace your createTokens function with this:
function createTokens() {
    const loader = new GLTFLoader();

    const tokenSetup = (model, tokenName, heightOffset = 2.5) => {
        model.traverse((object) => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });
        model.visible = false;
        model.userData.isToken = true;
        model.userData.tokenName = tokenName;
        model.position.set(22.5, heightOffset, 22.5);
        scene.add(model);
    };

    // Helper for each token
    function loadTokenModel(path, tokenName, scale, heightOffset, onLoaded) {
        showTokenSpinner(tokenName);
        loader.load(path, (gltf) => {
            const model = gltf.scene;
            model.scale.set(...scale);
            tokenSetup(model, tokenName, heightOffset);
            hideTokenSpinner(tokenName);
            if (onLoaded) onLoaded(model, gltf);
        }, undefined, (error) => {
            hideTokenSpinner(tokenName);
            console.error(`Error loading the ${tokenName} model:`, error);
        });
    }

    loadTokenModel('Models/nike_air_zoom_pegasus_36/scene.gltf', 'nike', [1.5, 1.5, 1.5], 3.0);
    loadTokenModel('Models/mcdonalds_big_mac/scene.gltf', 'burger', [3.5, 3.5, 3.5], 3.0);
    loadTokenModel('Models/rolls-royce_ghost/scene.gltf', 'rolls royce', [0.9, 0.9, 0.9], 3.0);
    loadTokenModel('Models/speed_boat_05/speedeboatscene.gltf', 'speed boat', [1.2, 1.2, 1.2], 3.0);
    loadTokenModel('Models/top_hat__free_download/tophat.gltf', 'hat', [0.5, 0.5, 0.5], 3.0);
    loadTokenModel('Models/wilson_football/football.gltf', 'football', [0.1, 0.1, 0.1], 3.0);
    loadTokenModel('Models/helicopter/scene.gltf', 'helicopter', [0.01, 0.01, 0.01], 3.0);

    // Woman token (with animation)
    showTokenSpinner('woman');
    loader.load('../Models/ModelIdleAnim/WhiteGirlBlackandRedOutfit.gltf', function (gltf) {
        const whiteGirlModel = gltf.scene;
        whiteGirlModel.traverse((child) => {
            if (child.isMesh) {
                child.material.transparent = false;
                child.material.depthWrite = true;
            }
        });
        whiteGirlModel.scale.set(0.02, 0.02, 0.02);
        tokenSetup(whiteGirlModel, 'woman', 0.5);

        const idleMixer = new THREE.AnimationMixer(whiteGirlModel);
        const idleAction = idleMixer.clipAction(gltf.animations[0]);
        idleAction.clampWhenFinished = true;
        idleAction.loop = THREE.LoopRepeat;
        idleAction.play();

        whiteGirlModel.userData.idleMixer = idleMixer;
        whiteGirlModel.userData.idleAction = idleAction;

        loader.load('../Models/ModelWalkAnim/WhiteGirlBlackandRedOutfitWalk.gltf', function (walkGltf) {
            const walkMixer = new THREE.AnimationMixer(whiteGirlModel);
            const walkAction = walkMixer.clipAction(walkGltf.animations[0]);
            walkAction.clampWhenFinished = true;
            walkAction.loop = THREE.LoopRepeat;

            whiteGirlModel.userData.walkMixer = walkMixer;
            whiteGirlModel.userData.walkAction = walkAction;
            hideTokenSpinner('woman');
        }, undefined, function (error) {
            hideTokenSpinner('woman');
            console.error(error);
        });
    }, undefined, function (error) {
        hideTokenSpinner('woman');
        console.error(error);
    });
}

function hopWithNikeEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to hopWithNikeEffect");
        return;
    }

    const duration = 1000; // Duration for the entire hop
    const startTime = Date.now();
    const hopHeight = 2; // Height of the hop
    const tiltAngle = 0.2; // Tilt angle for the "living shoe" effect
    const modelOffsetAngle = Math.PI; // Offset to make the Nike shoe face west

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate the current position
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + Math.sin(progress * Math.PI) * hopHeight;

        // Apply tilt effect
        const tilt = Math.sin(progress * Math.PI) * tiltAngle;

        // Update the token's position and rotation
        token.position.set(currentX, currentY, currentZ);

        // Rotate the token to face the movement direction with the offset
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        token.rotation.set(tilt, Math.atan2(directionVector.x, directionVector.z) + modelOffsetAngle, -tilt);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Reset rotation after the hop
            token.rotation.set(0, Math.atan2(endPos.x - startPos.x, endPos.z - startPos.z) + modelOffsetAngle, 0);
            if (callback) callback();
        }
    }

    animate();
}

function jumpWithBigMacEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to jumpWithBigMacEffect");
        return;
    }

    const duration = 1000; // Duration for the entire jump
    const startTime = Date.now();
    const jumpHeight = 5; // Height of the jump
    const squishFactor = 0.5; // Squish effect factor

    // Store the original scale of the token
    const originalScale = token.scale.clone();

    // Play squish sound when landing
    const squishSound = new Audio('Sounds/gooey-squish-14820.mp3');

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate the current position
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + Math.sin(progress * Math.PI) * jumpHeight;

        // Apply squish effect while preserving the original scale
        const squish = 1 - Math.abs(Math.sin(progress * Math.PI)) * squishFactor;
        token.scale.set(
            originalScale.x, // Preserve original x scale
            originalScale.y * squish, // Apply squish to y scale
            originalScale.z // Preserve original z scale
        );

        // Update the token's position
        token.position.set(currentX, currentY, currentZ);

        // Rotate the token to face the movement direction
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Reset the scale after the jump
            token.scale.copy(originalScale);

            // Play the squish sound when landing
            squishSound.play().catch(error => console.error("Failed to play squish sound:", error));

            if (callback) callback();
        }
    }

    animate();
}

function playWalkAnimation(token) {
    if (token.userData.tokenName === "woman" && token.userData.walkAction) {
        // Stop idle animation if it's playing
        if (token.userData.idleAction) {
            token.userData.idleAction.stop();
        }

        // Play the walking animation
        token.userData.walkAction.play();
    }
}

function stopWalkAnimation(token) {
    if (token.userData.tokenName === "woman" && token.userData.walkAction) {
        // Stop the walking animation
        token.userData.walkAction.stop();

        // Resume idle animation
        if (token.userData.idleAction) {
            token.userData.idleAction.play();
        }
    }
}

function updateMoneyDisplay() {
    try {
        const moneyElement = document.getElementById("player-money");
        if (!moneyElement) {
            const moneyDisplay = document.createElement("div");
            moneyDisplay.id = "player-money";
            moneyDisplay.className = "money-display";
            document.body.appendChild(moneyDisplay);
        }

        if (currentPlayerIndex < 0 || currentPlayerIndex >= players.length) {
            console.error("Invalid player index:", currentPlayerIndex);
            return;
        }

        const currentPlayer = players[currentPlayerIndex];
        if (!currentPlayer) {
            console.error("No player found at index:", currentPlayerIndex);
            return;
        }

        const playerType = isCurrentPlayerAI() ? 'AI ' : '';
        const moneyText = `${playerType}Player ${currentPlayerIndex + 1}'s Turn - Money: $${currentPlayer.money}`;
        document.getElementById("player-money").textContent = moneyText;

        checkBankruptcy(currentPlayer);
    } catch (error) {
        console.error("Error in updateMoneyDisplay:", error);
    }
}

function drawCard(cardType) {
    if (hasDrawnCard) {
        console.log("A card has already been drawn this turn. Skipping.");
        return; // Prevent drawing multiple cards
    }

    hasDrawnCard = true; // Set the flag to true after drawing a card

    const cards = cardType === "Chance" ? chanceCards : communityChestCards;
    const cardIndex = Math.floor(Math.random() * cards.length);
    const selectedCard = cards[cardIndex];
    const currentPlayer = players[currentPlayerIndex];

    if (isCurrentPlayerAI()) {
        console.log(`AI landed on ${cardType} and drew the card: "${selectedCard}".`);
        handleCardEffect(selectedCard, currentPlayer, () => {
            endTurn(); // Ensure the AI's turn ends after handling the card
        });
        return;
    }

    // Human player UI handling
    const overlay = document.createElement('div');
    overlay.className = 'property-overlay';

    const popup = document.createElement('div');
    popup.className = 'property-popup';

    const content = document.createElement('div');
    content.className = 'property-content';

    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = cardType;

    const cardText = document.createElement('div');
    cardText.className = 'card-prompt';
    cardText.textContent = selectedCard;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const proceedButton = document.createElement('button');
    proceedButton.className = 'action-button';
    proceedButton.textContent = 'Proceed';
    proceedButton.onclick = () => {
        overlay.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(overlay);
            handleCardEffect(selectedCard, currentPlayer, () => {
                endTurn(); // Ensure the human player's turn ends after handling the card
            });
        }, 300);
    };

    buttonContainer.appendChild(proceedButton);
    content.appendChild(header);
    content.appendChild(cardText);
    content.appendChild(buttonContainer);
    popup.appendChild(content);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });
}

function handleCardEffect(card, player, callback) {
    const regex = /\d+/;
    let amount;

    if (card.includes("Advance to")) {
        const destination = card.match(/Advance to (.+)/)[1];
        const destinationIndex = placeNames.findIndex(name => name === destination);
        if (destinationIndex >= 0) {
            const startPos = positions[player.currentPosition];
            const endPos = positions[destinationIndex];
            moveToken(startPos, endPos, player.selectedToken, () => {
                player.currentPosition = destinationIndex;
                handlePropertyLanding(player, destinationIndex);
                if (callback) callback(); // Ensure callback is invoked
            });
        }
    } else if (card.includes("Move forward")) {
        const spaces = parseInt(card.match(regex)[0]);
        moveTokenToNewPosition(spaces, () => {
            handlePropertyLanding(player, player.currentPosition);
            if (callback) callback(); // Ensure callback is invoked
        });
    } else if (card.includes("Move backward")) {
        const spaces = parseInt(card.match(regex)[0]);
        moveTokenToNewPosition(-spaces, () => {
            handlePropertyLanding(player, player.currentPosition);
            if (callback) callback(); // Ensure callback is invoked
        });
    } else if (card.includes("Collect") || card.includes("Receive")) {
        amount = parseInt(card.match(regex));
        player.money += amount;
        showFeedback(`Collected $${amount}!`);
        if (callback) callback(); // Ensure callback is invoked
    } else if (card.includes("Pay")) {
        amount = parseInt(card.match(regex));
        player.money -= amount;
        showFeedback(`Paid $${amount}!`);
        checkBankruptcy(player);
        if (callback) callback(); // Ensure callback is invoked
    } else if (card.includes("Go directly to Jail")) {
        goToJail(player);
        if (callback) callback(); // Ensure callback is invoked
    } else if (card === "Get Out of Jail Free") {
        player.cards = player.cards || [];
        player.cards.push(card);
        showFeedback("You received a Get Out of Jail Free card!");
        if (callback) callback(); // Ensure callback is invoked
    } else {
        if (callback) callback(); // Ensure callback is invoked
    }

    updateMoneyDisplay();
}

function handleCardAction(button, cardText) {
    const overlay = button.closest('.card-overlay');
    overlay.remove();
    applyCardEffect(cardText);
}

function handleAICardEffect(selectedCard) {
    const currentPlayer = players[currentPlayerIndex];
    const regex = /\d+/;
    let amount;

    if (selectedCard.includes("Advance to")) {
        const destination = selectedCard.match(/Advance to (.+)/)[1];
        const destinationIndex = placeNames.findIndex(name => name === destination);
        if (destinationIndex >= 0) {
            const startPos = positions[currentPlayer.currentPosition];
            const endPos = positions[destinationIndex];
            moveToken(startPos, endPos, currentPlayer.selectedToken, () => {
                currentPlayer.currentPosition = destinationIndex;
                handleAIPropertyDecision(properties.find(p => p.name === destination));
            });
        }
    } else if (selectedCard.includes("Move forward")) {
        const spaces = parseInt(selectedCard.match(regex)[0]);
        moveTokenToNewPosition(spaces); // Move forward the specified number of spaces
    } else if (selectedCard.includes("Move backward")) {
        const spaces = parseInt(selectedCard.match(regex)[0]);
        moveTokenToNewPosition(-spaces); // Move backward the specified number of spaces
    } else if (selectedCard.includes("Collect") || selectedCard.includes("Receive")) {
        amount = parseInt(selectedCard.match(regex));
        currentPlayer.money += amount;
        showAIDecision(`AI collected $${amount}`);
    } else if (selectedCard.includes("Pay")) {
        amount = parseInt(selectedCard.match(regex));
        currentPlayer.money -= amount;
        showAIDecision(`AI paid $${amount}`);
        checkBankruptcy(currentPlayer);
    } else if (selectedCard.includes("Go directly to Jail")) {
        goToJail(currentPlayer);
        showAIDecision("AI went to Jail!");
    } else if (selectedCard === "Get Out of Jail Free") {
        currentPlayer.cards = currentPlayer.cards || [];
        currentPlayer.cards.push(selectedCard);
        showAIDecision("AI received Get Out of Jail Free card");
    } else if (selectedCard.includes("Go back three spaces")) {
        moveTokenToNewPosition(-3); // Move backward 3 spaces
        showAIDecision("AI moved back 3 spaces");
    }

    updateMoneyDisplay();

    setTimeout(() => {
        endTurn();
    }, 2000);
}

function applyCardEffect(selectedCard) {
    const currentPlayer = players[currentPlayerIndex];

    if (selectedCard.includes("Go directly to Jail")) {
        goToJail(currentPlayer);
    } else if (selectedCard.includes("Move forward")) {
        const spaces = parseInt(selectedCard.match(/\d+/)[0]);
        moveTokenToNewPosition(spaces, () => {
            handlePropertyLanding(currentPlayer, currentPlayer.currentPosition);
        });
    } else if (selectedCard.includes("Move backward")) {
        const spaces = parseInt(selectedCard.match(/\d+/)[0]);
        moveTokenToNewPosition(-spaces, () => {
            handlePropertyLanding(currentPlayer, currentPlayer.currentPosition);
        });
    } else if (selectedCard.includes("Collect") || selectedCard.includes("Receive")) {
        const amount = parseInt(selectedCard.match(/\$(\d+)/)[1]);
        currentPlayer.money += amount;
        showFeedback(`Collected $${amount}!`);
    } else if (selectedCard.includes("Pay")) {
        const amount = parseInt(selectedCard.match(/\$(\d+)/)[1]);
        currentPlayer.money -= amount;
        showFeedback(`Paid $${amount}!`);
        checkBankruptcy(currentPlayer);
    }

    updateMoneyDisplay();

    // Automatically end the turn after handling the card
    setTimeout(() => {
        endTurn();
    }, 1000);
}

function handleUtilitySpace(player, property) {
    if (!property.owner) {
        if (!isCurrentPlayerAI()) {
            showPropertyUI(player.currentPosition);
        }
        return;
    }

    if (property.owner !== player) {
        // Roll dice for utility rent
        const dice1 = Math.ceil(Math.random() * 6);
        const dice2 = Math.ceil(Math.random() * 6);
        const diceTotal = dice1 + dice2;

        // Calculate rent based on utility ownership
        const utilityCount = property.owner.properties.filter(p => p.type === "utility").length;
        const multiplier = utilityCount === 1 ? 4 : 10;
        const rentAmount = diceTotal * multiplier;

        showFeedback(`Rolled ${diceTotal}. Rent is ${multiplier}× dice roll.`);

        if (player.money >= rentAmount) {
            player.money -= rentAmount;
            property.owner.money += rentAmount;
            showFeedback(`Paid $${rentAmount} rent to ${property.owner.name}`);
        } else {
            handleBankruptcy(player, property.owner);
        }
        updateMoneyDisplay();
    }
}

function handleRailroadSpace(player, property) {
    if (!property.owner) {
        if (!isCurrentPlayerAI()) {
            showPropertyUI(player.currentPosition);
        }
        return;
    }

    if (property.owner !== player) {
        // Calculate rent based on number of railroads owned
        const railroadCount = property.owner.properties.filter(p => p.type === "railroad").length;
        const rentAmount = property.rentWithRailroads[railroadCount - 1];

        if (player.money >= rentAmount) {
            player.money -= rentAmount;
            property.owner.money += rentAmount;
            showFeedback(`Paid $${rentAmount} rent to ${property.owner.name}`);
        } else {
            handleBankruptcy(player, property.owner);
        }
        updateMoneyDisplay();
    }
}

function showPropertyUI(position) {
    // Check if current player is AI first
    if (isCurrentPlayerAI()) {
        console.log("AI player - skipping property UI");
        const propertyName = placeNames[position];
        const property = properties.find(p => p.name === propertyName);
        if (property) {
            handleAIPropertyDecision(property, () => {
                setTimeout(() => endTurn(), 1500);
            });
        } else {
            setTimeout(() => endTurn(), 1500);
        }
        return;
    }

    const propertyName = placeNames[position];
    const property = properties.find(p => p.name === propertyName);

    if (!property) {
        console.error(`No property found for position ${position}`);
        return;
    }

    // Handle "GO" separately
    if (property.name === "GO") {
        showFeedback("You landed on GO! Collect $200 if you passed it.");
        endTurn(); // Automatically end the turn
        return;
    }

    // Handle "JAIL" separately
    if (property.name === "JAIL") {
        const currentPlayer = players[currentPlayerIndex];
        showJailUI(currentPlayer); // Call the Jail UI
        return;
    }

    // Handle "GO TO JAIL" separately
    if (property.name === "GO TO JAIL") {
        const currentPlayer = players[currentPlayerIndex];
        goToJail(currentPlayer); // Send the player to jail
        return;
    }

    // Handle "FREE PARKING" separately
    if (property.name === "FREE PARKING") {
        const currentPlayer = players[currentPlayerIndex];
        showFreeParkingUI(currentPlayer); // Show Free Parking UI
        return;
    }

    // Create overlay and popup
    const overlay = document.createElement('div');
    overlay.className = 'property-overlay';

    const popup = document.createElement('div');
    popup.className = 'property-popup';
    popup.style.width = '340px';
    popup.style.maxWidth = '95vw';
    popup.style.margin = '0 auto'; // Center horizontally

    const content = document.createElement('div');
    content.className = 'property-content';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.alignItems = 'center';
    content.style.gap = '8px';
    content.style.fontSize = '13px';

    // --- Video on top ---
let mediaShown = false;

if (property.videoUrls && property.videoUrls.length > 0) {
    const videoContainer = document.createElement('div');
    videoContainer.className = 'property-video-container';
    videoContainer.style.width = '160px';
    videoContainer.style.height = '90px';
    videoContainer.style.overflow = 'hidden';
    videoContainer.style.borderRadius = '8px';
    videoContainer.style.margin = '0 auto 4px auto';
    videoContainer.style.position = 'relative';
    videoContainer.style.display = 'flex';
    videoContainer.style.justifyContent = 'center';
    videoContainer.style.alignItems = 'center';

    // Placeholder with play icon
    const placeholder = document.createElement('div');
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.display = 'flex';
    placeholder.style.justifyContent = 'center';
    placeholder.style.alignItems = 'center';
    placeholder.style.cursor = 'pointer';

    const playIcon = document.createElement('div');
    playIcon.innerHTML = '&#9658;';
    playIcon.style.fontSize = '40px';
    playIcon.style.color = '#fff';
    playIcon.style.opacity = '0.85';
    playIcon.style.pointerEvents = 'none';
    placeholder.appendChild(playIcon);

    placeholder.onclick = () => {
        placeholder.style.display = 'none';
        const randomIndex = Math.floor(Math.random() * property.videoUrls.length);
        const selectedUrl = property.videoUrls[randomIndex];

        const video = document.createElement('video');
        video.muted = true; // Must be true for autoplay on mobile!
        video.playsInline = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('webkit-playsinline', '');
        video.autoplay = true;
        video.controls = true;
        video.preload = 'metadata';
        video.poster = 'Images/video-placeholder.jpg';
        video.src = selectedUrl;

        video.onerror = () => {
            video.style.display = 'none';
            showImageFallback();
        };

        // Try to unmute after loaded (may not work on all browsers)
        video.addEventListener('loadeddata', () => {
            video.muted = false;
            video.play().catch(() => {});
        });

        videoContainer.appendChild(video);
    };

    videoContainer.appendChild(placeholder);
    content.appendChild(videoContainer);
    mediaShown = true;
}

// Fallback: show image if no video or if video fails
function showImageFallback() {
    let imageUrl = null;
    if (Array.isArray(property.imageUrls) && property.imageUrls.length > 0) {
        imageUrl = property.imageUrls[0];
    } else if (typeof property.imageUrls === 'string' && property.imageUrls.length > 0) {
        imageUrl = property.imageUrls;
    }
    if (imageUrl) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'property-image-container';
        imageContainer.style.width = '160px';
        imageContainer.style.height = '90px';
        imageContainer.style.overflow = 'hidden';
        imageContainer.style.borderRadius = '8px';
        imageContainer.style.margin = '0 auto 4px auto';
        imageContainer.style.position = 'relative';
        imageContainer.style.display = 'flex';
        imageContainer.style.justifyContent = 'center';
        imageContainer.style.alignItems = 'center';

        const img = document.createElement('img');
        img.src = imageUrl;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        imageContainer.appendChild(img);
        content.appendChild(imageContainer);
        mediaShown = true;
    } else {
        // No image, show a placeholder
        const placeholder = document.createElement('div');
        placeholder.style.width = '160px';
        placeholder.style.height = '90px';
        placeholder.style.background = '#333';
        placeholder.style.display = 'flex';
        placeholder.style.justifyContent = 'center';
        placeholder.style.alignItems = 'center';
        placeholder.style.color = '#fff';
        placeholder.style.borderRadius = '8px';
        placeholder.textContent = 'No preview available';
        content.appendChild(placeholder);
        mediaShown = true;
    }
}

// If no video, show image immediately
if (!mediaShown) {
    showImageFallback();
}

    if ((!property.videoUrls || property.videoUrls.length === 0) && property.imageUrls && property.imageUrls.length > 0) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'property-image-container';
        imageContainer.style.width = '160px';
        imageContainer.style.height = '90px';
        imageContainer.style.overflow = 'hidden';
        imageContainer.style.borderRadius = '8px';
        imageContainer.style.margin = '0 auto 4px auto';
        imageContainer.style.position = 'relative';
        imageContainer.style.display = 'flex';
        imageContainer.style.justifyContent = 'center';
        imageContainer.style.alignItems = 'center';

        const img = document.createElement('img');
        img.src = property.imageUrls[0];
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '8px';
        imageContainer.appendChild(img);
        content.appendChild(imageContainer);
    }

    // --- Title under video ---
    const titleDiv = document.createElement('div');
    titleDiv.className = 'popup-header';
    titleDiv.style.backgroundColor = "transparent";
    titleDiv.style.fontSize = '14px';
    titleDiv.style.padding = '5px';
    titleDiv.style.margin = '0 0 4px 0';
    titleDiv.style.width = '100%';
    titleDiv.style.textAlign = 'center';
    titleDiv.textContent = property.name;
    content.appendChild(titleDiv);

    // --- Details and buttons side by side ---
    const rowContainer = document.createElement('div');
    rowContainer.style.display = 'flex';
    rowContainer.style.flexDirection = 'row';
    rowContainer.style.justifyContent = 'flex-start';
    rowContainer.style.alignItems = 'stretch'; // Make both columns stretch to same height
    rowContainer.style.gap = '8px';
    rowContainer.style.width = '100%';
    rowContainer.style.marginLeft = '0';
    rowContainer.style.boxSizing = 'border-box';

    // Details (side by side)
    const detailsContainer = document.createElement('div');
    detailsContainer.style.flex = '1 1 0';
    detailsContainer.style.fontSize = '11px';
    detailsContainer.style.display = 'flex';
    detailsContainer.style.alignItems = 'flex-start';
    detailsContainer.style.height = '100%';
    detailsContainer.style.minWidth = '0';
    detailsContainer.innerHTML = `
    <div class="property-details" style="display: flex; flex-direction: row; gap: 6px; height: 100%;">
        <div class="detail-col" style="display: flex; flex-direction: column; align-items: flex-start;">
            <span class="detail-label">Price:</span>
            <span class="detail-value">$${property.price || 'N/A'}</span>
        </div>
        <div class="detail-col" style="display: flex; flex-direction: column; align-items: flex-start;">
            <span class="detail-label">Rent:</span>
            <span class="detail-value">$${property.rent || 'N/A'}</span>
        </div>
        <div class="detail-col" style="display: flex; flex-direction: column; align-items: flex-start;">
            <span class="detail-label">Owner:</span>
            <span class="detail-value">${property.owner ? property.owner.name : 'None'}</span>
        </div>
        <div class="detail-col" style="display: flex; flex-direction: column; align-items: flex-start;">
            <span class="detail-label">Address:</span>
            <span class="detail-value">${property.address || 'No address available'}</span>
        </div>
    </div>
    `;

    // Buttons (vertical stack, right of details)
    const buttonContainer = createButtonContainer(property);
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.gap = '6px';
    buttonContainer.style.alignItems = 'stretch';
    buttonContainer.style.justifyContent = 'flex-end'; // Push close button to the bottom
    buttonContainer.style.alignSelf = 'stretch'; // Stretch to match details height
    buttonContainer.style.height = '100%';
    buttonContainer.style.marginTop = '0';
    buttonContainer.style.minWidth = '70px';
    buttonContainer.style.maxWidth = '90px';

    // Make the buttons themselves smaller
    Array.from(buttonContainer.querySelectorAll('button')).forEach(btn => {
        btn.style.padding = '6px 8px';
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '4px';
    });

    // Make button container the same height as details for alignment (optional)
    setTimeout(() => {
        const detailsHeight = detailsContainer.offsetHeight;
        buttonContainer.style.minHeight = detailsHeight + 'px';
    }, 0);

    rowContainer.appendChild(detailsContainer);
    rowContainer.appendChild(buttonContainer);

    content.appendChild(rowContainer);

    popup.appendChild(content);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        popup.classList.add('show');
    });

    // Prevent countdown until a decision is made
    const buyButton = buttonContainer.querySelector('.action-button.buy');
    const closeButton = buttonContainer.querySelector('.action-button.close');

    const startCountdown = () => {
        closePropertyUI();
        setTimeout(() => {
            endTurn(); // Start the countdown after decision
        }, 5000);
    };

    if (buyButton) {
        buyButton.addEventListener('click', startCountdown);
    }

    if (closeButton) {
        closeButton.addEventListener('click', startCountdown);
    }
}

function showJailUI(player) {
    // Check if the current player is AI
    if (isCurrentPlayerAI()) {
        console.log("AI landed on Jail. Skipping Jail UI for the player.");
        setTimeout(() => {
            endTurn(); // Automatically end the turn for AI
        }, 1500);
        return;
    }

    console.log("showJailUI called for player:", player.name);

    // Create the overlay
    const overlay = document.createElement('div');
    overlay.className = 'jail-overlay';

    // Create the popup
    const popup = document.createElement('div');
    popup.className = 'jail-popup';

    // Create a container for the video and content
    const contentContainer = document.createElement('div');
    contentContainer.className = 'jail-content-container';

    // Add video container on the left
    const videoContainer = document.createElement('div');
    videoContainer.className = 'jail-video-container';

    // Add a single randomized Jail video
    const jailVideos = [
        "Videos/Imgoingtojail.mp4",
        "Videos/Jailclip4.mp4",
        "Videos/Jailclip5.mp4",
        "Videos/jailclip6.mp4_1743296163946.mp4",
        "Videos/Jailmoment2(cropped).mp4",
        "Videos/jailmoment3(cropped).mp4"
    ];
    const randomVideo = jailVideos[Math.floor(Math.random() * jailVideos.length)];

    const video = document.createElement('video');
    video.src = randomVideo;
    video.controls = true;
    video.autoplay = true;
    video.muted = true; // Start muted
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';

    // Unmute the video when it is loaded
    video.addEventListener('loadeddata', () => {
        video.muted = false;
        video.play().catch(error => console.error("Failed to play video:", error));
    });

    videoContainer.appendChild(video);

    // Add content container on the right
    const content = document.createElement('div');
    content.className = 'jail-content';

    // Add header
    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = 'Jail';

    // Add message
    const message = document.createElement('div');
    message.className = 'jail-message';
    message.textContent = player.inJail
        ? `${player.name} is in Jail for ${player.jailTurns} more turn(s).`
        : `${player.name} is just visiting Jail.`;

    // Add button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    if (player.inJail) {
        // Pay Fine button
        const payFineButton = document.createElement('button');
        payFineButton.className = 'action-button';
        payFineButton.textContent = 'Pay $50 Fine';
        payFineButton.onclick = () => {
            if (player.money >= 50) {
                player.money -= 50;
                player.inJail = false;
                player.jailTurns = 0;
                showFeedback(`${player.name} paid $50 and got out of Jail.`);
                closePopup(overlay);
                endTurn();
            } else {
                showFeedback("Not enough money to pay the fine!");
            }
        };
        buttonContainer.appendChild(payFineButton);

        // Roll for Doubles button
        const rollDiceButton = document.createElement('button');
        rollDiceButton.className = 'action-button';
        rollDiceButton.textContent = 'Roll for Doubles';
        rollDiceButton.onclick = () => {
            const dice1 = Math.ceil(Math.random() * 6);
            const dice2 = Math.ceil(Math.random() * 6);
            if (dice1 === dice2) {
                player.inJail = false;
                player.jailTurns = 0;
                showFeedback(`${player.name} rolled doubles and got out of Jail!`);
                closePopup(overlay);
                endTurn();
            } else {
                player.jailTurns -= 1;
                showFeedback(`${player.name} failed to roll doubles. ${player.jailTurns} turn(s) left.`);
                if (player.jailTurns === 0) {
                    player.inJail = false;
                    showFeedback(`${player.name} is released from Jail.`);
                }
                closePopup(overlay);
                endTurn();
            }
        };
        buttonContainer.appendChild(rollDiceButton);
    } else {
        // Close button for visiting players
        const closeButton = document.createElement('button');
        closeButton.className = 'action-button close';
        closeButton.textContent = 'Close';
        closeButton.onclick = () => {
            closePopup(overlay);
            endTurn();
        };
        buttonContainer.appendChild(closeButton);
    }

    // Assemble the content
    content.appendChild(header);
    content.appendChild(message);
    content.appendChild(buttonContainer);

    // Add video and content to the container
    contentContainer.appendChild(videoContainer);
    contentContainer.appendChild(content);

    // Add the content container to the popup
    popup.appendChild(contentContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add fade-in animation
    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });
}

function createButtonContainer(property) {
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.height = '100%';

    const currentPlayer = players[currentPlayerIndex];

    // Top buttons wrapper
    const topButtons = document.createElement('div');
    topButtons.style.display = 'flex';
    topButtons.style.flexDirection = 'column';
    topButtons.style.gap = '6px';
    topButtons.style.flex = '0 0 auto'; // Prevent growing/shrinking

    if (property.owner && property.owner !== currentPlayer) {
        // Pay Rent button
        const payRentButton = document.createElement('button');
        payRentButton.className = 'action-button pay-rent';
        const rentAmount = calculateRent(property);
        payRentButton.textContent = `Pay Rent ($${rentAmount})`;
        payRentButton.onclick = () => {
            handleRentPayment(currentPlayer, property);
        };
        topButtons.appendChild(payRentButton);
    } else if (!property.owner) {
        // Buy Property button
        const buyButton = document.createElement('button');
        buyButton.className = 'action-button buy';
        buyButton.textContent = 'Buy Property';
        buyButton.onclick = () => {
            if (currentPlayer.money >= property.price) {
                buyProperty(currentPlayer, property);
                closePropertyUI();
            } else {
                showFeedback("Not enough money to buy this property!");
            }
        };
        topButtons.appendChild(buyButton);
    } else if (property.owner === currentPlayer) {
        // Property management buttons
        addPropertyManagementButtons(topButtons, property);
    }

    buttonContainer.appendChild(topButtons);

    // Spacer to push close button to the bottom
    const spacer = document.createElement('div');
    spacer.style.flex = '1 1 auto';
    spacer.style.minHeight = '0';
    buttonContainer.appendChild(spacer);

    // Close button at the bottom, moved up a bit
    const closeButton = document.createElement('button');
    closeButton.className = 'action-button close';
    closeButton.textContent = 'Close';
    closeButton.onclick = () => {
        closePropertyUI();
        endTurn();
    };
    closeButton.style.marginTop = '0';
    closeButton.style.marginBottom = '20px'; // Move the button up from the bottom
    closeButton.style.alignSelf = 'stretch';
    buttonContainer.appendChild(closeButton);

    return buttonContainer;
}

function closePropertyUI() {
    const overlay = document.querySelector('.property-overlay');
    if (!overlay) return;

    const popup = overlay.querySelector('.property-popup');
    if (popup) {
        popup.classList.remove('show');
        popup.classList.add('hide');
    }

    setTimeout(() => {
        if (overlay && overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
    }, 300);
}

function addPropertyManagementButtons(container, property) {
    if (!property.mortgaged) {
        // Mortgage button
        const mortgageButton = document.createElement('button');
        mortgageButton.className = 'action-button mortgage';
        mortgageButton.textContent = 'Mortgage';
        mortgageButton.onclick = () => mortgageProperty(players[currentPlayerIndex], property);
        container.appendChild(mortgageButton);

        // House/Hotel buttons for color properties
        if (property.color && !property.mortgaged) {
            addBuildingButtons(container, property);
        }
    } else {
        // Unmortgage button
        const unmortgageButton = document.createElement('button');
        unmortgageButton.className = 'action-button unmortgage';
        unmortgageButton.textContent = 'Unmortgage';
        unmortgageButton.onclick = () => unmortgageProperty(players[currentPlayerIndex], property);
        container.appendChild(unmortgageButton);
    }
}

function addBuildingButtons(container, property) {
    if (property.houses < 4) {
        const buyHouseButton = document.createElement('button');
        buyHouseButton.className = 'action-button buy-house';
        buyHouseButton.textContent = 'Buy House';
        buyHouseButton.onclick = () => buyHouse(property);
        container.appendChild(buyHouseButton);
    } else if (!property.hotel) {
        const buyHotelButton = document.createElement('button');
        buyHotelButton.className = 'action-button buy-hotel';
        buyHotelButton.textContent = 'Buy Hotel';
        buyHotelButton.onclick = () => buyHotel(property);
        container.appendChild(buyHotelButton);
    }
}

function showErrorMessage(message) {
    const errorContainer = document.querySelector('.error-container');
    if (!errorContainer) return;

    const errorMessage = document.createElement('div');
    errorMessage.className = 'error-message';
    errorMessage.textContent = message;

    // Remove any existing error messages
    while (errorContainer.firstChild) {
        errorContainer.removeChild(errorContainer.firstChild);
    }

    errorContainer.appendChild(errorMessage);

    // Auto-remove error message after 3 seconds
    setTimeout(() => {
        if (errorMessage.parentElement) {
            errorMessage.classList.add('fade-out');
            setTimeout(() => {
                if (errorMessage.parentElement) {
                    errorMessage.parentElement.removeChild(errorMessage);
                }
            }, 300);
        }
    }, 3000);
}

function updateBoards() {
    const currentPlayer = players[currentPlayerIndex];
    updatePropertyManagementBoard(currentPlayer); // Show properties only for the current player
    updateOtherPlayersBoard(currentPlayer); // Update the board for other players
}

// Buy property logic
function buyProperty(player, property, callback) {
    if (!property || property.owner) {
        console.error("Property is either invalid or already owned.");
        return;
    }

    if (player.money >= property.price) {
        player.money -= property.price;
        property.owner = player;
        player.properties.push(property);

        showFeedback(`${player.name} bought ${property.name} for $${property.price}`);
        updateMoneyDisplay();
        updateBoards();

        hasTakenAction = true; // Mark that the player has taken an action

        // Close the property UI after purchase
        closePropertyUI();

        // End turn if a callback is provided (for AI)
        if (callback) {
            callback(); // Ensure the AI's turn completion logic is triggered
        } else {
            setTimeout(() => endTurn(), 1000); // End the turn manually for human players
        }
    } else {
        showFeedback("Not enough money to buy this property!");
    }
}

// Add token selection
function onTokenClick(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    for (let intersect of intersects) {
        let object = intersect.object;
        while (object && !object.userData.isToken) {
            object = object.parent;
        }
        if (object && object.userData.isToken) {
            // Deselect previous token if exists
            if (selectedToken) {
                selectedToken.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material.emissive.setHex(0x000000); // Reset emissive color
                    }
                });
            }
            // Select new token
            selectedToken = object;
            // Highlight selected token
            object.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    // Preserve existing material properties
                    child.material = child.material.clone();
                    child.material.needsUpdate = true;
                }
            });

            console.log(`Selected token: ${object.userData.tokenName}`);
            break;
        }
    }
}

function getBoardSquarePosition(squareIndex) {
    const boardSize = 18.5;
    const spacing = 7;

    // Calculate position based on board quadrant
    if (squareIndex <= 10) {
        // Bottom row
        return {
            x: boardSize - squareIndex * spacing,
            y: 2, // Token height
            z: boardSize,
        };
    } else if (squareIndex <= 20) {
        // Left column
        return {
            x: -boardSize,
            y: 2,
            z: boardSize - (squareIndex - 10) * spacing,
        };
    } else if (squareIndex <= 30) {
        // Top row
        return {
            x: -boardSize + (squareIndex - 20) * spacing,
            y: 2,
            z: -boardSize,
        };
    } else {
        // Right column
        return {
            x: boardSize,
            y: 2,
            z: -boardSize + (squareIndex - 30) * spacing,
        };
    }
}

function onPropertyClick(event) {
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const clickedObject = intersects[0].object;

        // Check if we clicked on a property
        if (clickedObject.parent && clickedObject.parent.type === "Group") {
            if (!isPopupVisible) {
                createPropertyPopup(clickedObject.parent.position);
            }
        }
    } else if (isPopupVisible) {
        removePropertyPopup();
    }
}

function createPropertyPopup(position) {
    if (isPopupVisible) {
        removePropertyPopup();
    }

    // Find the property at this position
    const propertyIndex = positions.findIndex(pos =>
        pos.x === position.x &&
        pos.z === position.z
    );

    if (propertyIndex === -1) return;

    const propertyName = placeNames[propertyIndex];
    const property = properties.find(p => p.name === propertyName);

    if (!property) return;

    // Create popup geometry
    const popupGeometry = new THREE.PlaneGeometry(5, 3);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 256;

    // Style the popup
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#000000';
    context.font = 'bold 36px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Add property name
    context.fillText(property.name, canvas.width / 2, 40);

    // Add property details
    context.font = '24px Arial';
    let yPos = 80;
    const lineHeight = 30;

    if (property.price) {
        context.fillText(`Price: $${property.price}`, canvas.width / 2, yPos);
        yPos += lineHeight;
    }

    if (property.rent) {
        context.fillText(`Rent: $${property.rent}`, canvas.width / 2, yPos);
        yPos += lineHeight;
    }

    if (property.owner) {
        context.fillText(`Owner: ${property.owner.name}`, canvas.width / 2, yPos);
        yPos += lineHeight;
    }

    if (property.description) {
        // Word wrap the description
        const words = property.description.split(' ');
        let line = '';
        context.font = '20px Arial';

        words.forEach(word => {
            const testLine = line + word + ' ';
            const metrics = context.measureText(testLine);

            if (metrics.width > canvas.width - 40) {
                context.fillText(line, canvas.width / 2, yPos);
                line = word + ' ';
                yPos += lineHeight;
            } else {
                line = testLine;
            }
        });
        context.fillText(line, canvas.width / 2, yPos);
    }

    // Create texture and material
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
    });

    // Create popup mesh
    const popup = new THREE.Mesh(popupGeometry, material);
    popup.position.set(position.x, position.y + 4, position.z);
    popup.lookAt(camera.position);

    // Add to popup group
    popupGroup.add(popup);
    isPopupVisible = true;

    // Add fade-in animation
    popup.material.opacity = 0;
    const fadeIn = () => {
        if (popup.material.opacity < 0.9) {
            popup.material.opacity += 0.05;
            requestAnimationFrame(fadeIn);
        }
    };
    fadeIn();

    // Auto-remove popup after 5 seconds
    setTimeout(() => {
        if (isPopupVisible) {
            removePropertyPopup();
        }
    }, 5000);
}

function removePropertyPopup() {
    if (isPopupVisible) {
        const popup = popupGroup.children[0];

        // Animate popup removal
        const startScale = 1;
        const endScale = 0.1;
        const duration = 300;
        const startTime = Date.now();

        function animatePopupRemoval() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            const currentScale = startScale + (endScale - startScale) * progress;
            popup.scale.set(currentScale, currentScale, currentScale);

            if (progress < 1) {
                requestAnimationFrame(animatePopupRemoval);
            } else {
                popupGroup.remove(popup);
                isPopupVisible = false;
            }
        }

        animatePopupRemoval();
    }
}

function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Reduced from 0.6
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4); // Reduced from 0.8
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 100;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLights = [{
            pos: [20, 15, 20],
            color: 0x888888
        },
        {
            pos: [-20, 15, 20],
            color: 0x888888
        },
        {
            pos: [-20, 15, -20],
            color: 0x888888
        },
        {
            pos: [20, 15, -20],
            color: 0x888888
        },
    ];

    pointLights.forEach((light) => {
        const pointLight = new THREE.PointLight(light.color, 0.1); // Reduced from 0.5
        pointLight.position.set(...light.pos);
        scene.add(pointLight);
    });
}

function createBoard() {
    const boardSize = 70; // Adjust size accordingly
    const boardOffset = 0; // Center the board at origin

    const boardGeometry = new THREE.BoxGeometry(boardSize, 1, boardSize);
    const boardMaterial = new THREE.MeshPhongMaterial({
        color: 0x444444,
        specular: 0x666666,
        shininess: 100,
    });
    const board = new THREE.Mesh(boardGeometry, boardMaterial);
    board.receiveShadow = true;
    board.position.set(boardOffset, 0, boardOffset);

    scene.add(board);
}

function createCardDecks() {
    const cardThickness = 0.03; // The thickness of each card
    const cardDeckLength = 5; // Adjusted length to simulate a playing card
    const cardDeckWidth = 7; // Adjust width to resemble playing card width
    const stackBaseHeight = 0.5; // The initial height of the stack
    const numCardsInStack = 40; // Number of cards in each stack

    // Function to create card stacks
    function createCardStack(deckType, position) {
        const cardMaterial = new THREE.MeshPhongMaterial({
            color: 0xCCCCCC, // Light grey color for card back
            specular: 0x777777,
            shininess: 30,
        });

        for (let i = 0; i < numCardsInStack; i++) {
            const cardGeometry = new THREE.BoxGeometry(cardDeckLength, cardThickness, cardDeckWidth);
            const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);

            // Add random slight rotation for a jumbled stack effect
            cardMesh.rotation.y = (Math.random() - 0.5) * 0.1;
            cardMesh.position.set(position.x, stackBaseHeight + i * cardThickness, position.z);

            scene.add(cardMesh);
        }

        // Add a label to the top of the stack
        addCardLabel(deckType, position, stackBaseHeight + numCardsInStack * cardThickness + (cardDeckLength / 4));
    }

    // Add a label on top of the stack
    function addCardLabel(deckType, position, height) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 256; // Adjust as necessary to fit content

        context.fillStyle = "#000";
        context.font = 'bold 20px Arial'; // Reduced font size
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const texts = deckType.split('\n');
        texts.forEach((text, index) => {
            context.fillText(text, canvas.width / 2, (canvas.height / (texts.length + 1)) * (index + 1));
        });

        const labelTexture = new THREE.CanvasTexture(canvas);
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: labelTexture,
            transparent: true
        });
        const labelGeometry = new THREE.PlaneGeometry(10, 5); // Adjust proportions as necessary
        const cardLabel = new THREE.Mesh(labelGeometry, labelMaterial);

        cardLabel.position.set(position.x, height, position.z);
        cardLabel.rotation.x = -Math.PI / 2;
        scene.add(cardLabel);
    }

    // Create Chance card stack
    createCardStack('Chance\nCards', {
        x: -12.5,
        y: 0,
        z: 0
    });

    // Create Community Chest card stack
    createCardStack('Community\nCards', {
        x: 12.5,
        y: 0,
        z: 0
    });

}

function onCardDeckClick(deckType) {
    drawCard(deckType);
}

function handleDeckClicks(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    intersects.some((intersect) => {
        const object = intersect.object;
        if (object.material.map && object.material.map.image) {
            const text = object.material.map.image.textContent || object.material.map.image.innerHTML;
            if (text === 'Chance' || text === 'Community Cards') {
                onCardDeckClick(text);
                return true;
            }
        }
        return false;
    });
}

window.addEventListener("click", handleDeckClicks);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function validateTurnOrder() {
    const expectedPlayerIndex = (lastPlayerIndex + 1) % players.length;

    if (currentPlayerIndex !== expectedPlayerIndex) {
        console.error(`Turn order violated! Expected Player ${expectedPlayerIndex + 1}, but got Player ${currentPlayerIndex + 1}.`);
        alert(`Turn order violated! Reverting to Player ${expectedPlayerIndex + 1}'s turn.`);

        // Revert to the correct player's turn
        currentPlayerIndex = expectedPlayerIndex;
        updateMoneyDisplay();

        // If it's an AI player's turn, execute their turn
        if (isCurrentPlayerAI()) {
            executeAITurn();
        }

        return false; // Indicate that the turn order was invalid
    }

    return true; // Turn order is valid
}

function endTurn() {
    if (isTurnInProgress) {
        console.log("Turn is still in progress. Cannot end turn yet.");
        return;
    }

    console.log(`Ending turn for Player ${currentPlayerIndex + 1} (${players[currentPlayerIndex].name})`);

    try {
        // Reset all turn-related flags
        isTurnInProgress = true; // Temporarily set to true during transition
        hasTakenAction = false;
        hasRolledDice = false;
        hasMovedToken = false;
        hasHandledProperty = false;
        hasDrawnCard = false;
        isAIProcessing = false;

        // Store the last player's index
        lastPlayerIndex = currentPlayerIndex;

        // Move to the next valid player
        let nextPlayerFound = false;
        const startingIndex = currentPlayerIndex;
        let attempts = 0;

        while (!nextPlayerFound && attempts < players.length) {
            currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
            const nextPlayer = players[currentPlayerIndex];

            if (nextPlayer && !nextPlayer.eliminated && nextPlayer.money >= 0) {
                nextPlayerFound = true;
                console.log(`Next turn is for Player ${currentPlayerIndex + 1} (${nextPlayer.name})`);
            }

            attempts++;
        }

        if (!nextPlayerFound) {
            console.error("No valid players found for next turn!");
            checkGameEnd();
            return;
        }

        const currentPlayer = players[currentPlayerIndex];

        // Update UI elements
        updateMoneyDisplay();
        updateBoards();

        // Show/hide roll button based on player type
        const rollButton = document.querySelector('.dice-button');
        if (rollButton) {
            rollButton.style.display = isCurrentPlayerAI() ? 'none' : 'block';
        }

        // Handle specific player situations
        if (currentPlayer.inJail) {
            console.log(`Player ${currentPlayerIndex + 1} is in jail`);
            handlePlayerInJail(currentPlayer);
        } else {
            // Start the next player's turn
            setTimeout(() => {
                isTurnInProgress = false; // Reset the flag
                if (isCurrentPlayerAI()) {
                    console.log(`Starting AI turn for Player ${currentPlayerIndex + 1}`);
                    executeAITurn();
                } else {
                    console.log(`Starting human turn for Player ${currentPlayerIndex + 1}`);
                    allowedToRoll = true;
                    showFeedback(`${currentPlayer.name}'s turn - Roll the dice!`);
                }
            }, 1000);
        }

        // Increment turn counter for game progression
        turnCounter++;

        // Validate game state periodically
        if (turnCounter % 4 === 0) {
            validateGameState();
        }

    } catch (error) {
        console.error("Error in endTurn:", error);
        isTurnInProgress = false; // Ensure the flag is reset even if an error occurs
    }
}

function startPlayerTurn(player) {
    console.log(`Starting turn for Player ${currentPlayerIndex + 1} (${player.name})`);

    // Reset turn-related flags
    allowedToRoll = true;
    isTurnInProgress = false;
    hasDrawnCard = false; // Reset the card drawing flag

    updateMoneyDisplay();
    updateBoards();

    if (isCurrentPlayerAI()) {
        console.log(`Executing AI turn for Player ${currentPlayerIndex + 1} (${player.name})`);
        executeAITurn();
    } else {
        console.log(`Waiting for Player ${currentPlayerIndex + 1} (${player.name}) to roll dice.`);
    }
}

function validateGameState() {
    console.log("Validating game state...");

    // Validate players array
    if (!Array.isArray(players) || players.length === 0) {
        console.error("Invalid players array");
        initializePlayers();
    }

    // Validate current player index
    if (currentPlayerIndex < 0 || currentPlayerIndex >= players.length) {
        console.error("Invalid currentPlayerIndex");
        currentPlayerIndex = 0;
    }

    // Validate all players have proper properties
    players.forEach((player, index) => {
        if (typeof player.money !== 'number') {
            console.error(`Player ${index + 1} has invalid money value`);
            player.money = 1500;
        }
        if (!Array.isArray(player.properties)) {
            player.properties = [];
        }
    });

    console.log("Game state validation complete");
}

function initializePlayers() {
    // Clear existing players array
    players = [];

    // Create 4 player slots with default values
    for (let i = 0; i < 4; i++) {
        players.push({
            name: `Player ${i + 1}`,
            money: 1500,
            properties: [],
            selectedToken: null,
            tokenName: null,
            currentPosition: 0,
            isAI: false,
            inJail: false,
            jailTurns: 0,
            cards: []
        });
    }
    console.log("Players initialized:", players);
}

function createPlayerTokenSelectionUI(playerIndex) {
    if (initialSelectionComplete) return;

    tokenSelectionUI = document.createElement("div");
    tokenSelectionUI.style.position = "fixed";
    tokenSelectionUI.style.top = "10px";
    tokenSelectionUI.style.left = "20px";
    tokenSelectionUI.style.padding = "15px";
    tokenSelectionUI.style.borderRadius = "10px";
    tokenSelectionUI.style.color = "white";
    tokenSelectionUI.style.textAlign = "center";
    tokenSelectionUI.style.zIndex = "1000";
    tokenSelectionUI.style.width = "300px";
    tokenSelectionUI.style.maxHeight = "400px";

    const title = document.createElement("h2");
    title.textContent = "Select Tokens and AI Players";
    title.className = "flash-title";
    title.style.marginBottom = "15px";
    title.style.fontSize = "18px";
    tokenSelectionUI.appendChild(title);

    const tokenGrid = document.createElement("div");
    tokenGrid.style.display = (window.innerWidth < 700) ? "flex" : "grid";
    tokenGrid.style.flexDirection = (window.innerWidth < 700) ? "column" : "";
    tokenGrid.style.gridTemplateColumns = (window.innerWidth < 700) ? "" : "repeat(2, 1fr)";
    tokenGrid.style.gap = (window.innerWidth < 700) ? "2vw" : "8px";
    tokenGrid.style.padding = (window.innerWidth < 700) ? "2vw" : "5px";

    if (window.innerWidth < 700) {
    tokenGrid.style.maxHeight = "60vh";
    tokenGrid.style.overflowY = "auto";
}

    availableTokens.forEach((token, index) => {
        const tokenButton = createTokenButton(token, index);
        tokenGrid.appendChild(tokenButton);
    });

    const startButton = document.createElement("button");
    startButton.textContent = "Start Game";
    startButton.className = "action-button";
    startButton.style.marginTop = "15px";
    startButton.disabled = true; // Start disabled
    startButton.style.opacity = "0.7";
    startButton.onclick = finalizePlayerSelection;

    // Add flashing effect and arrows
    startButton.style.position = "relative";
    startButton.style.transition = "box-shadow 0.3s, background 0.3s";
    startButton.style.boxShadow = "0 0 0 0 #fff";
    startButton.style.background = "#444";

    // Create arrow elements
    const arrowUp = document.createElement("div");
    arrowUp.innerHTML = "&#8595;";
    arrowUp.style.position = "absolute";
    arrowUp.style.top = "-30px";
    arrowUp.style.left = "50%";
    arrowUp.style.transform = "translateX(-50%)";
    arrowUp.style.fontSize = "28px";
    arrowUp.style.color = "#ff0";
    arrowUp.style.display = "none";
    arrowUp.className = "arrow-flash";

    const arrowDown = document.createElement("div");
    arrowDown.innerHTML = "&#8593;";
    arrowDown.style.position = "absolute";
    arrowDown.style.bottom = "-30px";
    arrowDown.style.left = "50%";
    arrowDown.style.transform = "translateX(-50%) rotate(180deg)";
    arrowDown.style.fontSize = "28px";
    arrowDown.style.color = "#ff0";
    arrowDown.style.display = "none";
    arrowDown.className = "arrow-flash";

    startButton.appendChild(arrowUp);
    startButton.appendChild(arrowDown);

    // Add flashing animation via CSS
    const style = document.createElement("style");
    style.textContent = `
        @keyframes flashButton {
            0% { box-shadow: 0 0 10px 2px #fff, 0 0 30px 10px #ff0; background: #444; }
            50% { box-shadow: 0 0 30px 10px #ff0, 0 0 10px 2px #fff; background: #666; }
            100% { box-shadow: 0 0 10px 2px #fff, 0 0 30px 10px #ff0; background: #444; }
        }
        .flash-active {
            animation: flashButton 1s infinite;
        }
        .arrow-flash {
            animation: arrowFlash 1s infinite;
        }
        @keyframes arrowFlash {
            0% { color: #ff0; opacity: 1; }
            50% { color: #fff; opacity: 0.6; }
            100% { color: #ff0; opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    tokenSelectionUI.appendChild(tokenGrid);
    tokenSelectionUI.appendChild(startButton);
    document.body.appendChild(tokenSelectionUI);

    // Update button state on load
    updateStartButtonVisibility();

    // Overwrite updateStartButtonVisibility to handle flashing and arrows
    window.updateStartButtonVisibility = function () {
        const count = humanPlayerCount + aiPlayers.size;
        if (count >= 2 && count <= 4) {
            startButton.disabled = false;
            startButton.style.opacity = "1";
            startButton.classList.add("flash-active");
            arrowUp.style.display = "block";
            arrowDown.style.display = "block";
        } else {
            startButton.disabled = true;
            startButton.style.opacity = "0.7";
            startButton.classList.remove("flash-active");
            arrowUp.style.display = "none";
            arrowDown.style.display = "none";
        }
    };
}

function finalizePlayerSelection() {
    const totalPlayers = humanPlayerCount + aiPlayers.size;
    if (totalPlayers < 2 || totalPlayers > 4) {
        showNotification("You must select 2, 3, or 4 tokens (players or AI) before starting the game!");
        return;
    }

    console.log('Finalizing player selection...');

    // Filter out players without tokens
    players = players.filter(player => player.tokenName !== null);

    // Set up each player properly
    players.forEach((player, index) => {
        player.isAI = aiPlayers.has(player.tokenName);
        player.currentPosition = 0;
        player.money = 1500;
        player.properties = [];
        player.inJail = false;
        player.jailTurns = 0;
        player.cards = [];

        // Find and set up the token
        const tokenObject = scene.children.find(obj =>
            obj.userData.isToken &&
            obj.userData.tokenName === player.tokenName
        );

        if (tokenObject) {
            // Set up token
            player.selectedToken = tokenObject;
            tokenObject.visible = true;

            // Position at GO
            const startPos = positions[0];
            tokenObject.position.set(startPos.x, 2.5, startPos.z);
            tokenObject.userData.playerIndex = index;

            // Remove any existing highlights/indicators
            tokenObject.children = tokenObject.children.filter(
                child => !child.userData.isHighlight && !child.userData.isPlayerIndicator
            );

            // Add new highlight
            const highlightMaterial = new THREE.MeshPhongMaterial({
                color: getPlayerColor(index),
                transparent: true,
                opacity: 0.3
            });

            const highlightGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 32);
            const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
            highlight.position.y = -0.5;
            highlight.userData.isHighlight = true;
            tokenObject.add(highlight);

            console.log(`Set up player ${index + 1}:`, {
                tokenName: player.tokenName,
                position: tokenObject.position.toArray(),
                isAI: player.isAI
            });
        } else {
            console.error(`Could not find token for player ${index + 1}:`, player.tokenName);
            alert(`Error: Token for Player ${index + 1} (${player.name}) is missing. Please reselect tokens.`);
        }
    });

    // Final checks
    const invalidPlayers = players.filter(p => !p.selectedToken);
    if (invalidPlayers.length > 0) {
        console.error("Some players are missing tokens:", invalidPlayers);
        alert("Error setting up players. Please refresh and try again.");
        return;
    }

    initialSelectionComplete = true;

    // Remove token selection UI
    if (tokenSelectionUI && tokenSelectionUI.parentElement) {
        document.body.removeChild(tokenSelectionUI);
    }
    tokenSelectionUI = null;

    // Show the "Roll Dice" button
    const rollButton = document.querySelector('.dice-button');
    if (rollButton) {
        rollButton.style.display = 'block';
    }

    // Set up first turn
    currentPlayerIndex = 0;
    updateMoneyDisplay();

    // Start game with appropriate turn
    if (isCurrentPlayerAI()) {
        console.log('Starting with AI turn');
        executeAITurn();
    } else {
        console.log('Starting with human turn');
        allowedToRoll = true;
    }

    // Debug log final game state
    console.log('Game started with players:', players.map(p => ({
        name: p.name,
        tokenName: p.tokenName,
        isAI: p.isAI,
        position: p.currentPosition,
        hasToken: !!p.selectedToken
    })));

    console.log('Finalizing player selection...');
}

function isJailCorner(startPos, endPos) {
    return (startPos.z === 22.5 && endPos.x === -22.5) || (startPos.x === -22.5 && endPos.z === 22.5);
}


function createProperties() {
    const propertySize = 5;
    const propertyHeight = 0.5;
    const yPosition = 1.5;

    const propertyMaterial = new THREE.MeshPhongMaterial({
        color: 0x888888,
        specular: 0xaaaaaa,
        shininess: 100,
    });

    positions.forEach((pos, index) => {
        const propertyGeometry = new THREE.BoxGeometry(propertySize, propertyHeight, propertySize);
        const propertyMesh = new THREE.Mesh(propertyGeometry, propertyMaterial);

        propertyMesh.position.set(pos.x, yPosition, pos.z);
        propertyMesh.castShadow = true;
        propertyMesh.receiveShadow = true;

        propertyMesh.userData.isProperty = true;
        propertyMesh.userData.name = placeNames[index];

        addPropertyText(propertyMesh, placeNames[index]);
        scene.add(propertyMesh);
    });
}

function addPropertyText(property, name) {
    const letterFolderPath = "Images/diamondLetters/"; // Path to the folder containing letter images
    const letterSize = 0.4; // Reduced size of each letter image to prevent overlapping
    const letterSpacing = 0.3; // Adjusted spacing between letters for better alignment

    const group = new THREE.Group(); // Create a group to hold all letter planes
    const textureLoader = new THREE.TextureLoader();
    const letters = name.toUpperCase().split(""); // Convert name to uppercase and split into letters

    // Calculate total width of the text for centering
    const totalWidth = letters.length * letterSpacing;
    let xOffset = -totalWidth / 2 + letterSpacing / 2; // Center the letters horizontally

    function getLetterImage(letter) {
        const validLetters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        if (validLetters.includes(letter)) {
            return `${letterFolderPath}Diamond${letter}.png`; // Map "A" to "DiamondA.png", etc.
        }
        return null; // Return null for invalid characters
    }

    letters.forEach((letter) => {
        if (letter === " ") {
            xOffset += letterSpacing; // Add spacing for spaces
            return;
        }

        const letterPath = getLetterImage(letter);
        if (!letterPath) {
            console.warn(`Invalid letter: ${letter}`);
            return;
        }

        const texture = textureLoader.load(
            letterPath,
            (texture) => {
                texture.encoding = THREE.sRGBEncoding;
                texture.flipY = false; // Ensure the texture is not flipped vertically
                texture.needsUpdate = true;
            },
            undefined,
            (error) => {
                console.error(`Failed to load texture ${letterPath}:`, error);
            }
        );

        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.5,
            side: THREE.DoubleSide, // Ensure the texture is visible from both sides
        });

        const geometry = new THREE.PlaneGeometry(letterSize, letterSize);

        const plane = new THREE.Mesh(geometry, material);
        plane.position.set(
            xOffset,
            property.geometry.parameters.height / 2 + 0.1, // Slightly above the property square
            0
        );

        // Ensure the plane is flat and mirrored correctly
        plane.rotation.set(-Math.PI / 2, 0, Math.PI); // Lay the plane flat and rotate it 180 degrees to fix orientation
        plane.scale.set(-1, 1, 1); // Remove the horizontal mirroring

        group.add(plane);
        addDiamondSparkleToPlane(plane); 

        xOffset += letterSpacing; // Move to the next letter position
    });

    property.add(group);
}

// Sparkle effect for a Three.js plane mesh (letter)
function addDiamondSparkleToPlane(plane) {
    const NUM_SPARKLES = 4 + Math.floor(Math.random() * 2); // 4-5 sparkles per letter
    const sparkleMeshes = [];
    for (let i = 0; i < NUM_SPARKLES; i++) {
        // Create a canvas for the sparkle texture
        const sparkleCanvas = document.createElement('canvas');
        sparkleCanvas.width = 32;
        sparkleCanvas.height = 32;
        const ctx = sparkleCanvas.getContext('2d');
        // Draw a simple sparkle (star)
        ctx.clearRect(0, 0, 32, 32);
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(16, 0); ctx.lineTo(20, 12); ctx.lineTo(32, 16);
        ctx.lineTo(20, 20); ctx.lineTo(16, 32); ctx.lineTo(12, 20);
        ctx.lineTo(0, 16); ctx.lineTo(12, 12); ctx.closePath();
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 8;
        ctx.fill();

        const sparkleTexture = new THREE.CanvasTexture(sparkleCanvas);
        const sparkleMaterial = new THREE.MeshBasicMaterial({
            map: sparkleTexture,
            transparent: true,
            depthWrite: false,
            opacity: 0
        });
        // Make the sparkle much smaller than the letter
        const sparkleScale = 0.18 + Math.random() * 0.08; // 0.18-0.26 of letter size
        const sparkleGeometry = new THREE.PlaneGeometry(
            plane.geometry.parameters.width * sparkleScale,
            plane.geometry.parameters.height * sparkleScale
        );
        const sparkleMesh = new THREE.Mesh(sparkleGeometry, sparkleMaterial);
        // Random position within the letter plane bounds
        const margin = 0.12 * plane.geometry.parameters.width;
        const x = (Math.random() - 0.5) * (plane.geometry.parameters.width - margin);
        const y = (Math.random() - 0.5) * (plane.geometry.parameters.height - margin);
        sparkleMesh.position.copy(plane.position);
        sparkleMesh.position.x += x;
        sparkleMesh.position.z += y; // since plane is rotated, y in plane space is z in world
        sparkleMesh.position.y += 0.012 + Math.random() * 0.01; // slightly above the letter
        sparkleMesh.rotation.copy(plane.rotation);
        sparkleMesh.renderOrder = 999;

        // Animate sparkle: fade in/out and random scale/rotation
        // ...inside addDiamondSparkleToPlane, replace animateSparkle function...
        function animateSparkle() {
            const duration = 0.8 + Math.random() * 0.8; // 0.8–1.6s for each sparkle
            const delay = 2.5 + Math.random() * 2.5; // 2.5–5s between sparkles

            let startTime = null;

            function sparkleStep(timestamp) {
                if (!startTime) startTime = timestamp;
                const elapsed = (timestamp - startTime) / 1000;
                const t = Math.min(elapsed / duration, 1);

                // Use a sine wave for smooth fade in/out
                const alpha = Math.sin(Math.PI * t);
                sparkleMesh.material.opacity = 0.7 * alpha;

                // Optionally, scale and rotate for extra realism
                const scale = 0.7 + 0.3 * alpha;
                sparkleMesh.scale.setScalar(scale);

                if (t < 1) {
                    requestAnimationFrame(sparkleStep);
                } else {
                    sparkleMesh.material.opacity = 0;
                    setTimeout(() => {
                        startTime = null;
                        requestAnimationFrame(sparkleStep);
                    }, delay * 1000);
                }
            }

            // Start with a random delay for staggered sparkles
            setTimeout(() => requestAnimationFrame(sparkleStep), Math.random() * 1200);
        }
        setTimeout(animateSparkle, Math.random() * 1200);
        plane.parent.add(sparkleMesh);
        sparkleMeshes.push(sparkleMesh);
    }
}

// Helper function to wrap text
function wrapText(context, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
            currentLine += " " + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

function createTextSprite(property, text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 256;

    // Style text
    context.font = 'Bold 40px Arial';
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.fillText(text, 128, 128);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });

    // Create sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 1, 1);
    sprite.position.set(0, property.geometry.parameters.height / 2 + 0.1, 0);

    property.add(sprite);
}

function onMouseMove(event) {
    if (!editMode || !draggedObject) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -draggedObject.position.y);
    const intersectPoint = new THREE.Vector3();
}

// Call updateEditModeUI within toggle functions

window.addEventListener("keydown", (event) => {
    if (event.code === "KeyE") {
        toggleEditMode();
    }
});

function moveTokenWithJump(startPos, endPos, token) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to moveTokenWithJump", {
            token,
            startPos,
            endPos
        });
        return;
    }

    const duration = 500; // Duration for one space movement
    const startTime = Date.now();
    const jumpHeight = 0.5;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing calculation
        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate positions
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + 0.29 + Math.sin(progress * Math.PI) * jumpHeight;

        // Update token position
        token.position.set(currentX, currentY, currentZ);

        // Rotate token to face movement direction
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    animate();
}

function getTokenHeight(tokenName, baseHeight) {
    const heightOffsets = {
        hat: 0.5, // Offset for the "hat" token
        woman: 0.5, // Offset for the "woman" token
        // Add offsets for other tokens as needed
    };

    return baseHeight + (heightOffsets[tokenName] || 0);
}

function updateFollowCamera(token) {
    if (!token) return;

    // Position the follow camera slightly above and behind the token
    const offset = new THREE.Vector3(0, 5, -10); // Adjust offset as needed
    const tokenPosition = token.position.clone();
    const cameraPosition = tokenPosition.add(offset);

    followCamera.position.copy(cameraPosition); // Directly set the camera position
    followCamera.lookAt(token.position); // Ensure the camera looks at the token
}

function moveToken(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to moveToken");
        return;
    }

    isTokenMoving = true; // Set the flag to true when movement starts
    isFollowingToken = true; // Activate the follow camera
    selectedToken = token; // Set the token for the follow camera

    // Play the walking animation for the "woman" token
    if (token.userData.tokenName === "woman") {
        playWalkAnimation(token);
    }

    // Determine the animation based on the token type
    const tokenName = token.userData.tokenName;

    if (tokenName === "nike") {
        const nikeHeight = 0.7; // Adjusted height for the Nike shoe
        const adjustedStartPos = { ...startPos, y: startPos.y + nikeHeight };
        const adjustedEndPos = { ...endPos, y: endPos.y + nikeHeight };

        hopWithNikeEffect(adjustedStartPos, adjustedEndPos, token, () => {
            finalizeMove(token, adjustedEndPos, callback);
        });
    } else if (tokenName === "burger") {
        jumpWithBigMacEffect(startPos, endPos, token, () => {
            finalizeMove(token, endPos, callback);
        });
    } else if (tokenName === "hat") {
        const hatHeight = 1.8; // Adjusted height for the hat
        jumpWithHatEffect(
            { ...startPos, y: startPos.y + hatHeight },
            { ...endPos, y: endPos.y + hatHeight },
            token,
            () => {
                finalizeMove(token, endPos, callback);
            }
        );
    } else if (tokenName === "woman") {
        const womanHeight = 0.5; // Adjusted height for the woman token
        const adjustedStartPos = { ...startPos, y: startPos.y + womanHeight };
        const adjustedEndPos = { ...endPos, y: endPos.y + womanHeight };

        // Use default movement logic with height adjustment
        const duration = 1000; // Duration for moving between two spaces
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Linear interpolation for smooth movement
            const currentX = adjustedStartPos.x + (adjustedEndPos.x - adjustedStartPos.x) * progress;
            const currentZ = adjustedStartPos.z + (adjustedEndPos.z - adjustedStartPos.z) * progress;

            // Update token position
            token.position.set(currentX, adjustedStartPos.y, currentZ);

            // Rotate token to face movement direction
            const directionVector = new THREE.Vector3(
                adjustedEndPos.x - adjustedStartPos.x,
                0,
                adjustedEndPos.z - adjustedStartPos.z
            ).normalize();
            token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

            // Update the follow camera position
            if (isFollowingToken) {
                updateFollowCamera(token);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                finalizeMove(token, adjustedEndPos, callback);
            }
        }

        animate();
    } else if (tokenName === "speed boat") {
        driveWithSpeedboatEffect(startPos, endPos, token, () => {
            finalizeMove(token, endPos, callback);
        });
    } else if (tokenName === "rolls royce") {
        driveWithDefaultEffect(startPos, endPos, token, () => {
            finalizeMove(token, endPos, callback);
        });
    } else if (tokenName === "helicopter") {
        flyWithHelicopterEffect(startPos, endPos, token, () => {
            finalizeMove(token, endPos, callback);
        });
    } else if (tokenName === "football") {
        const finalHeight = getTokenHeight(tokenName, endPos.y) + 1.0; // Add height for the throw
        throwFootballAnimation(token, endPos, finalHeight, () => {
            finalizeMove(token, endPos, callback);
        });
    } else {
        // Default movement for other tokens
        const duration = 1000; // Duration for moving between two spaces
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Linear interpolation for smooth movement
            const currentX = startPos.x + (endPos.x - startPos.x) * progress;
            const currentZ = startPos.z + (endPos.z - startPos.z) * progress;

            // Update token position
            token.position.set(currentX, startPos.y, currentZ);

            // Rotate token to face movement direction
            const directionVector = new THREE.Vector3(
                endPos.x - startPos.x,
                0,
                endPos.z - startPos.z
            ).normalize();
            token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

            // Update the follow camera position
            if (isFollowingToken) {
                updateFollowCamera(token);
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                finalizeMove(token, endPos, callback);
            }
        }

        animate();
    }
}

function finalizeMove(token, endPos, callback) {
    // Get the base height from the property square
    const baseHeight = endPos.y;

    // Calculate the final height for the token
    let finalHeight = getTokenHeight(token.userData.tokenName, baseHeight);

    // Adjust height for specific tokens
    if (token.userData.tokenName === "nike") {
        finalHeight += 0.5; // Raise the Nike shoe to the correct height
    } else if (token.userData.tokenName === "burger") {
        finalHeight += 0.7; // Raise the burger to the correct height
    } else if (token.userData.tokenName === "speed boat") {
        finalHeight += 0.5; // Raise the boat slightly higher
    } else if (token.userData.tokenName === "rolls royce") {
        finalHeight += 0.3; // Raise the Rolls Royce slightly higher
    } else if (token.userData.tokenName === "football") {
        finalHeight += 1.0; // Raise the football higher
    }

    // Ensure final position is exact
    token.position.set(endPos.x, finalHeight, endPos.z);

    // Stop the walking animation and switch to idle for the "woman" token
    if (token.userData.tokenName === "woman") {
        stopWalkAnimation(token);
    }

    isTokenMoving = false; // Set the flag to false when movement ends
    isFollowingToken = false; // Deactivate the follow camera

    if (callback) callback();
}

function createTokenButton(token, index) {
    const tokenButton = document.createElement("div");
    tokenButton.className = "token-button";

    // Style the button
    tokenButton.style.backgroundColor = players.some(player => player.tokenName === token.name) ? "#555" : "#333";
    tokenButton.style.pointerEvents = players.some(player => player.tokenName === token.name) ? "none" : "auto";
    tokenButton.style.position = "relative";
    tokenButton.style.transition = "all 0.3s ease";
    tokenButton.style.display = "flex";
    tokenButton.style.flexDirection = "column";
    tokenButton.style.alignItems = "center";
    tokenButton.style.justifyContent = "center";
    tokenButton.style.padding = "10px 0";
    tokenButton.style.margin = "4px";
    tokenButton.style.borderRadius = "8px";
    tokenButton.style.width = "150px"; // Increased width from 120px to 150px
    tokenButton.style.height = "100px";
    tokenButton.style.cursor = "pointer";

    // Create content container
    const tokenContent = document.createElement("div");
    tokenContent.className = "token-content";
    tokenContent.style.display = "flex";
    tokenContent.style.flexDirection = "column";
    tokenContent.style.alignItems = "center";
    tokenContent.style.justifyContent = "center";
    tokenContent.style.width = "100%";
    tokenContent.style.height = "100%";

    // Create token image
    const tokenImg = document.createElement("img");
    tokenImg.src = getTokenImageUrl(token.name);
    tokenImg.alt = token.displayName;
    tokenImg.style.width = "60px";
    tokenImg.style.height = "50px";
    tokenImg.style.marginBottom = "8px";
    tokenImg.style.borderRadius = "4px";
    tokenImg.style.objectFit = "contain";

    // Check if token is already owned
    const owner = players.find(player => player.tokenName === token.name);
    if (owner) {
        tokenImg.style.filter = "grayscale(100%) blur(1px)";
    }

    // Create token name label
    const tokenName = document.createElement("div");
    tokenName.textContent = token.displayName;
    tokenName.style.fontSize = "12px";
    tokenName.style.fontWeight = "bold";
    tokenName.style.textAlign = "center";
    tokenName.style.color = owner ? "#888" : "#fff";
    tokenName.style.minHeight = "20px";
    tokenName.style.maxWidth = "100%";

    // Create AI button
    const aiButton = document.createElement("button");
    aiButton.className = "ai-button";
    aiButton.textContent = aiPlayers.has(token.name) ? "Disable PC" : "Click to Enable PC";
    aiButton.classList.toggle("active", aiPlayers.has(token.name));
    aiButton.style.marginTop = "5px";
    aiButton.style.padding = "4px 8px";
    aiButton.style.borderRadius = "4px";
    aiButton.style.border = "none";
    aiButton.style.cursor = "pointer";
    aiButton.style.backgroundColor = aiPlayers.has(token.name) ? "#4CAF50" : "#666";
    aiButton.style.color = "#fff";

    // Add AI indicator
    const aiIndicator = document.createElement("div");
    aiIndicator.className = "ai-indicator";
    aiIndicator.classList.toggle("active", aiPlayers.has(token.name));
    aiIndicator.style.position = "absolute";
    aiIndicator.style.top = "5px";
    aiIndicator.style.right = "5px";
    aiIndicator.style.width = "10px";
    aiIndicator.style.height = "10px";
    aiIndicator.style.borderRadius = "50%";
    aiIndicator.style.backgroundColor = aiPlayers.has(token.name) ? "#4CAF50" : "transparent";

    // Handle AI button click
    aiButton.onclick = (e) => {
        e.stopPropagation();
        if (!initialSelectionComplete) {
            toggleAI(token, aiButton);
        }
    };

    // Handle token selection
    tokenButton.addEventListener("click", () => {
        if (!initialSelectionComplete && !owner) { 
            if (humanPlayerCount >= 4) {
                alert("Maximum 4 players allowed!");
                return;
            }

            if (aiPlayers.has(token.name)) {
                alert("This token is set as AI player!");
                return;
            }

            const currentPlayer = players[humanPlayerCount];
            if (!currentPlayer) {
                console.error("Invalid player index:", humanPlayerCount);
                return;
            }

            currentPlayer.tokenName = token.name;
            const selectedTokenObject = scene.children.find(obj =>
                obj.userData.isToken &&
                obj.userData.tokenName === token.name
            );

            if (selectedTokenObject) {
                currentPlayer.selectedToken = selectedTokenObject;
                selectedTokenObject.visible = true;
                selectedTokenObject.position.set(22.5, 2.5, 22.5);
                selectedTokenObject.userData.playerIndex = humanPlayerCount;

                // Add highlight effect
                const highlightMaterial = new THREE.MeshPhongMaterial({
                    color: getPlayerColor(humanPlayerCount),
                    transparent: true,
                    opacity: 0.3
                });

                const highlightGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 32);
                const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
                highlight.position.y = -0.5;
                highlight.userData.isHighlight = true;

                // Remove any existing highlights
                selectedTokenObject.children = selectedTokenObject.children.filter(
                    child => !child.userData.isHighlight
                );
                selectedTokenObject.add(highlight);

                humanPlayerCount++;

                // Update button appearance
                tokenImg.style.filter = "grayscale(100%) blur(1px)";
                tokenButton.style.backgroundColor = "#555";
                tokenButton.style.pointerEvents = "none";
                tokenName.style.color = "#888";

                // Disable AI button
                aiButton.disabled = true;
                aiButton.style.opacity = "0.5";
                aiButton.style.cursor = "not-allowed";

                // Update start button visibility
                updateStartButtonVisibility();

                console.log(`Token ${token.name} selected for Player ${humanPlayerCount}`);
            } else {
                console.error(`Token object not found for ${token.name}`);
                alert("Error selecting token. Please try again.");
                return;
            }
        }
    });

    // Assemble the button
    tokenContent.appendChild(tokenImg);
    tokenContent.appendChild(tokenName);
    tokenContent.appendChild(aiButton);
    tokenButton.appendChild(tokenContent);
    tokenButton.appendChild(aiIndicator);

    // Add "Taken" overlay if token is already selected
    if (owner) {
        const takenOverlay = document.createElement("div");
        takenOverlay.className = "taken-overlay";
        takenOverlay.textContent = "Taken";
        takenOverlay.style.position = "absolute";
        takenOverlay.style.top = "0";
        takenOverlay.style.left = "0";
        takenOverlay.style.right = "0";
        takenOverlay.style.bottom = "0";
        takenOverlay.style.display = "flex";
        takenOverlay.style.justifyContent = "center";
        takenOverlay.style.alignItems = "center";
        takenOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
        takenOverlay.style.color = "#fff";
        takenOverlay.style.borderRadius = "8px";
        takenOverlay.style.fontSize = "14px";
        takenOverlay.style.fontWeight = "bold";
        tokenButton.appendChild(takenOverlay);
    }

    // Add hover effect
    tokenButton.addEventListener('mouseover', () => {
        if (!owner && !initialSelectionComplete) {
            tokenButton.style.transform = 'scale(1.05)';
            tokenButton.style.backgroundColor = "#444";
        }
    });

    tokenButton.addEventListener('mouseout', () => {
        if (!owner && !initialSelectionComplete) {
            tokenButton.style.transform = 'scale(1)';
            tokenButton.style.backgroundColor = "#333";
        }
    });

    return tokenButton;
}

function throwFootballAnimation(token, endPos, finalHeight, callback) {
    const startPos = token.position.clone();
    const duration = 2000; // Duration of the throw animation in milliseconds
    const startTime = Date.now();
    const arcHeight = 5; // Height of the arc for the throw

    // Create and play the woosh sound
    const wooshSound = new Audio('Sounds/long-whoosh-194554.mp3');
    wooshSound.volume = 0.5; // Adjust volume as needed
    wooshSound.play().catch(error => console.error("Failed to play woosh sound:", error));

    // Switch to the follow camera
    isFollowingToken = true;
    selectedToken = token; // Set the token for the follow camera

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeProgress = progress < 0.5
            ? 2 * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate the current position
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + Math.sin(progress * Math.PI) * arcHeight;

        // Update the token's position
        token.position.set(currentX, currentY, currentZ);

        // Rotate the football to simulate spinning
        token.rotation.x += 0.2;
        token.rotation.y += 0.1;

        // Update the follow camera position
        if (isFollowingToken) {
            updateFollowCamera(token);
        }

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Ensure the football lands at the correct height
            token.position.set(endPos.x, finalHeight, endPos.z);

            // Revert to the main camera after the animation
            isFollowingToken = false;

            if (callback) callback();
        }
    }

    animate();
}

function jumpWithHatEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to jumpWithHatEffect");
        return;
    }

    const duration = 1000; // Duration for the entire jump
    const startTime = Date.now();
    const jumpHeight = 5; // Height of the jump
    const landingOffset = 0.4; // Small offset to prevent glitching into the property space

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function for smooth animation
        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate the current position
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + Math.sin(progress * Math.PI) * jumpHeight;

        // Update the token's position
        token.position.set(currentX, currentY, currentZ);

        // Rotate the token to face the movement direction
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        token.rotation.set(0, Math.atan2(directionVector.x, directionVector.z), 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Ensure the token lands slightly above the property space
            token.position.set(endPos.x, startPos.y + landingOffset, endPos.z);
            if (callback) callback();
        }
    }

    animate();
}

// Default animation for non-speedboat tokens
function driveWithDefaultEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to driveWithDefaultEffect");
        return;
    }

    const duration = 500; // Reduced from 1000 to 500 (0.5 seconds)
    const startTime = Date.now();

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + 0.29;

        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        const angle = Math.atan2(directionVector.x, directionVector.z);

        token.position.set(currentX, currentY, currentZ);
        token.rotation.set(0, angle, 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else if (callback) {
            callback();
        }
    }

    animate();
}

function driveWithSpeedboatEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to driveWithSpeedboatEffect");
        return;
    }

    const duration = 1000; // Reduced from 2000 to 1000 (1 second)
    const startTime = Date.now();
    const bobbingHeight = 0.05;
    const bobbingFrequency = 1.5;
    const modelOffsetAngle = Math.PI / 2;

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;
        const currentY = startPos.y + 0.7 + Math.sin(elapsed / 1000 * bobbingFrequency * Math.PI) * bobbingHeight;

        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        const angle = Math.atan2(directionVector.x, directionVector.z);

        token.position.set(currentX, currentY, currentZ);
        token.rotation.set(0, angle + modelOffsetAngle, 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else if (callback) {
            callback();
        }
    }

    animate();
}

function driveStraightWithSpeedboat(startPos, endPos, token, callback) {
    driveWithSpeedboatEffect(startPos, endPos, token, callback);
}

function flyWithHelicopterEffect(startPos, endPos, token, callback) {
    if (!token || !startPos || !endPos) {
        console.error("Invalid parameters passed to flyWithHelicopterEffect");
        return;
    }

    const duration = 1000; // Duration for the animation
    const flightHeight = 5; // Height the helicopter will fly at
    const startTime = Date.now();
    const modelOffsetAngle = Math.PI + Math.PI / 2; // Rotate to face west correctly

    function animate() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Smooth easing for the movement
        const easeProgress = progress < 0.5 ?
            2 * progress * progress :
            1 - Math.pow(-2 * progress + 2, 2) / 2;

        // Calculate the current position
        const currentX = startPos.x + (endPos.x - startPos.x) * easeProgress;
        const currentZ = startPos.z + (endPos.z - startPos.z) * easeProgress;

        // Maintain a constant flight height during the animation
        const currentY = startPos.y + flightHeight;

        // Update the token's position
        token.position.set(currentX, currentY, currentZ);

        // Calculate the direction vector and angle
        const directionVector = new THREE.Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z).normalize();
        const angle = Math.atan2(directionVector.x, directionVector.z);

        // Update the helicopter's rotation to face the movement direction with an offset
        token.rotation.set(0, angle + modelOffsetAngle, 0);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            // Ensure the helicopter lands at the correct height
            token.position.set(endPos.x, 1.9, endPos.z); // Set `y` to the board's surface height
            if (callback) callback();
        }
    }

    animate();
}

// Example usage for moving the helicopter token
function moveHelicopterToNewPosition(spaces) {
    const currentPlayer = players[currentPlayerIndex];

    if (!currentPlayer.selectedToken || currentPlayer.selectedToken.userData.tokenName !== "helicopter") {
        console.error("No helicopter token assigned to the current player.");
        return;
    }

    const oldPosition = currentPlayer.currentPosition;
    const propertiesCount = positions.length;
    const newPosition = (oldPosition + spaces) % propertiesCount;

    const token = currentPlayer.selectedToken;
    let currentSpace = oldPosition;

    function moveOneSpace() {
        if (currentSpace === newPosition) {
            finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
            return;
        }

        const nextSpace = (currentSpace + 1) % propertiesCount;
        const startPos = positions[currentSpace];
        const endPos = positions[nextSpace];

        flyWithHelicopterEffect(startPos, endPos, token, () => {
            currentSpace = nextSpace;
            moveOneSpace();
        });
    }

    moveOneSpace();
}


// Helper function to handle movement completion
function finishMove(player, newPosition, passedGo) {
    // Update player position
    player.currentPosition = newPosition;

    // Handle passing GO
    if (passedGo && !player.inJail) {
        player.money += 200;
        showFeedback("Passed GO! Collect $200");
        updateMoneyDisplay();
    }

    const landingSpace = placeNames[newPosition];
    const property = properties.find(p => p.name === landingSpace);

    // Determine actions based on player type
    if (isCurrentPlayerAI()) {
        // AI action handling
        setTimeout(() => {
            switch (landingSpace) {
                case "Chance":
                case "Community Cards":
                    console.log(`AI landed on ${landingSpace}.`);
                    drawCard(landingSpace);
                    break;
                case "Income Tax":
                    handleIncomeTax(player);
                    break;
                case "Luxury Tax":
                    handleLuxuryTax(player);
                    break;
                case "GO TO JAIL":
                    console.log("AI landed on GO TO JAIL. Sending to Jail.");
                    goToJail(player);
                    setTimeout(() => endTurn(), 1500); // End AI's turn
                    return;
                case "JAIL":
                    console.log("AI landed on Jail. Just visiting.");
                    setTimeout(() => endTurn(), 1500); // AI does nothing and ends turn
                    break;
                case "FREE PARKING":
                    console.log("AI landed on Free Parking. Taking a break.");
                    setTimeout(() => endTurn(), 1500); // AI does nothing and ends turn
                    break;
                default:
                    if (property) {
                        handleAIPropertyDecision(property);
                    }
            }
        }, 1500);
    } else {
        // Human player action handling
        switch (landingSpace) {
            case "Chance":
                drawCard("Chance");
                break;
            case "Community Cards":
                drawCard("Community Cards");
                break;
            case "Income Tax":
                handleIncomeTax(player);
                break;
            case "Luxury Tax":
                handleLuxuryTax(player);
                break;
            case "GO TO JAIL":
                console.log("Player landed on GO TO JAIL.");
                showGoToJailUI(player);
                return; // Return early as showGoToJailUI will handle the rest
            case "JAIL":
                showJailUI(player);
                return;
            case "FREE PARKING":
                showFreeParkingUI(player);
                return;
            default:
                if (property && !player.inJail) {
                    showPropertyUI(newPosition);
                }
        }
    }

    updateMoneyDisplay();
}

function showGoToJailUI(player) {
    const overlay = document.createElement('div');
    overlay.className = 'goto-jail-overlay';

    const popup = document.createElement('div');
    popup.className = 'goto-jail-popup';

    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = 'GO TO JAIL';

    const message = document.createElement('div');
    message.textContent = `${player.name}, you are being sent directly to Jail. Do not pass GO. Do not collect $200.`;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const continueButton = document.createElement('button');
    continueButton.className = 'action-button';
    continueButton.textContent = 'Continue';
    continueButton.onclick = () => {
        goToJail(player);
        closePopup(overlay);
        endTurn(); // End the turn after sending the player to jail
    };

    buttonContainer.appendChild(continueButton);
    popup.appendChild(header);
    popup.appendChild(message);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });

    // Automatically end the turn after a delay (optional, for smoother gameplay)
    setTimeout(() => {
        if (overlay.parentElement) {
            goToJail(player);
            closePopup(overlay);
            endTurn();
        }
    }, 5000); // Adjust delay as needed
}

function handleAIDecision(property) {
    if (!property) return;

    // Handle special properties
    if (property.type === "special") {
        handleAISpecialProperty(property);
        return;
    }

    // Handle regular properties
    if (!property.owner) {
        const shouldBuy = makeAIBuyDecision(players[currentPlayerIndex], property);
        if (shouldBuy) {
            buyProperty(players[currentPlayerIndex], property);
            showFeedback(`AI bought ${property.name}`);
        }
    }
}

function handleAISpecialProperty(property) {
    const currentPlayer = players[currentPlayerIndex];

    switch (property.name) {
        case "Chance":
            drawCard("Chance");
            break;
        case "Community Cards":
            drawCard("Community Cards");
            break;
    }
}

function handlePropertyLanding(player, position) {
    const propertyName = placeNames[position];
    const property = properties.find(p => p.name === propertyName);

    if (!property) {
        console.error(`No property found for position ${position}`);
        endTurn();
        return;
    }

    console.log(`${player.name} landed on: ${property.name}`, property);

    // Handle "JAIL" property
    if (property.name === "JAIL") {
        if (player.inJail) {
            console.log(`${player.name} is in Jail for ${player.jailTurns} more turn(s).`);
            showJailUI(player);
        } else {
            console.log(`${player.name} is just visiting Jail.`);
            showJailUI(player);
        }
        return;
    }

    // Handle Income Tax
    if (property.name === "Income Tax") {
        handleIncomeTax(player);
        return;
    }

    // Handle Luxury Tax
    if (property.name === "Luxury Tax") {
        handleLuxuryTax(player);
        return;
    }

    // Handle GO TO JAIL
    if (property.name === "GO TO JAIL") {
        console.log(`${player.name} landed on GO TO JAIL`);
        goToJail(player);
        return;
    }

    // Handle FREE PARKING
    if (property.name === "FREE PARKING") {
        console.log(`${player.name} landed on FREE PARKING`);
        showFreeParkingUI(player);
        return;
    }

    // Handle Chance and Community Chest
    if (property.name === "Chance" || property.name === "Community Cards") {
        drawCard(property.name);
        return;
    }

    // Handle property ownership scenarios
    if (property.owner && property.owner !== player) {
        console.log(`${player.name} landed on ${property.name}, owned by ${property.owner.name}`);
        
        // Handle utilities differently
        if (property.type === "utility") {
            handleUtilitySpace(player, property);
            return;
        }

        // Handle railroads differently
        if (property.type === "railroad") {
            handleRailroadSpace(player, property);
            return;
        }

        // Handle regular properties
        const rentAmount = calculateRent(property);
        console.log(`Rent amount calculated: $${rentAmount}`);
        
        if (isCurrentPlayerAI()) {
            // AI automatically pays rent
            handleRentPayment(player, property);
        } else {
            // Show property UI for human players
            showPropertyUI(position);
        }
    } else if (!property.owner) {
        // Property is unowned
        console.log(`${player.name} landed on unowned property: ${property.name}`);
        if (isCurrentPlayerAI()) {
            handleAIPropertyDecision(property, () => {
                setTimeout(() => endTurn(), 1500);
            });
        } else {
            showPropertyUI(position);
        }
    } else {
        // Player owns the property
        console.log(`${player.name} landed on their own property: ${property.name}`);
        if (!isCurrentPlayerAI()) {
            showPropertyUI(position);
        } else {
            setTimeout(() => endTurn(), 1500);
        }
    }

    // Update displays
    updateMoneyDisplay();
    updateBoards();

    // Check for bankruptcy after any money-related actions
    if (player.money < 0) {
        console.log(`${player.name} is bankrupt!`);
        handleBankruptcy(player, property.owner);
        return;
    }

    // If no other return conditions met, ensure turn eventually ends
    setTimeout(() => {
        if (isTurnInProgress) {
            console.log(`Ending turn for ${player.name} after property handling`);
            endTurn();
        }
    }, 2000);
}

function calculateRailroadRent(property) {
    const railroadCount = property.owner.properties.filter(p => p.type === "railroad").length;
    return property.rentWithRailroads[railroadCount - 1];
}

function handleSpecialSpace(player, property) {
    switch (property.name) {
        case "Chance":
            drawCard("Chance");
            break;
        case "Community Cards":
            drawCard("Community Cards");
            break;
        case "Income Tax":
            handleIncomeTax(player);
            break;
        case "Luxury Tax":
            handleLuxuryTax(player);
            break;
        case "GO TO JAIL":
            goToJail(player);
            break;
        case "FREE PARKING":
            showFeedback("Free Parking - Take a break!");
            endTurn(); // End the turn immediately
            break;
        default:
            console.error(`Unhandled special space: ${property.name}`);
    }
}

function handleAIChanceCard() {
    const card = chanceCards[Math.floor(Math.random() * chanceCards.length)];
    showAIDecision(`AI draws a Chance card`);
    setTimeout(() => {
        applyCardEffect(card);
    }, 1000);
}

function handleAICommunityCard() {
    const card = communityChestCards[Math.floor(Math.random() * communityChestCards.length)];
    showAIDecision(`AI draws a Community Chest card`);
    setTimeout(() => {
        applyCardEffect(card);
    }, 1000);
}

function showIncomeTaxUI(player) {
    const overlay = document.createElement('div');
    overlay.className = 'income-tax-overlay';

    const popup = document.createElement('div');
    popup.className = 'income-tax-popup';

    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = 'Income Tax';

    const message = document.createElement('div');
    message.className = 'income-tax-message';
    message.textContent = `${player.name}, you must pay $200 or 10% of your total worth.`;

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';

    const pay200Button = document.createElement('button');
    pay200Button.className = 'action-button pay';
    pay200Button.textContent = 'Pay $200';
    pay200Button.onclick = () => {
        if (player.money >= 200) {
            player.money -= 200;
            showFeedback("You paid $200 in Income Tax.");
            updateMoneyDisplay();
        } else {
            showFeedback("Not enough money to pay!");
        }
        closePopup(overlay);
    };

    const pay10PercentButton = document.createElement('button');
    pay10PercentButton.className = 'action-button pay';
    pay10PercentButton.textContent = 'Pay 10%';
    pay10PercentButton.onclick = () => {
        const taxAmount = Math.floor(player.money * 0.1);
        if (player.money >= taxAmount) {
            player.money -= taxAmount;
            showFeedback(`You paid $${taxAmount} in Income Tax.`);
            updateMoneyDisplay();
        } else {
            showFeedback("Not enough money to pay!");
        }
        if (overlay) {
            closePopup(overlay);
        } else {
            console.error("Overlay is undefined or null.");
        }
    };

    const closeButton = document.createElement('button');
    closeButton.className = 'action-button close';
    closeButton.textContent = 'Close';
    closeButton.onclick = () => closePopup(overlay);

    buttonContainer.appendChild(pay200Button);
    buttonContainer.appendChild(pay10PercentButton);
    buttonContainer.appendChild(closeButton);
    popup.appendChild(header);
    popup.appendChild(message);
    popup.appendChild(buttonContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });
}

function makeAIMortgageDecision(player, property) {
    // AI logic for mortgage/unmortgage decisions
    if (player.money < 150 && !property.mortgaged) {
        // Mortgage if low on money
        mortgageProperty(player, property);
        showAIDecision(`AI mortgages ${property.name} for emergency funds`);
    } else if (player.money >= property.mortgageValue * 1.5 && property.mortgaged) {
        // Unmortgage if has plenty of money
        unmortgageProperty(player, property);
        showAIDecision(`AI unmortgages ${property.name}`);
    }
}

function hasMonopolyPotential(player, property) {
    if (!property.color) return false;

    const sameColorProperties = properties.filter(p => p.color === property.color);
    const ownedCount = sameColorProperties.filter(p => p.owner === player).length;
    const unownedCount = sameColorProperties.filter(p => !p.owner).length;

    // Return true if AI already owns some properties of this color or many are available
    return ownedCount > 0 || unownedCount >= sameColorProperties.length - 1;
}

function isStrategicLocation(property) {
    // Define strategic locations (e.g., properties near corners, utilities, railroads)
    const strategicIndices = [1, 3, 5, 15, 25, 35]; // Example indices
    return strategicIndices.includes(placeNames.indexOf(property.name));
}

function showAIDecision(message) {
    const decision = document.createElement('div');
    decision.className = 'ai-decision';
    decision.textContent = message;
    document.body.appendChild(decision);

    // Animate decision message
    requestAnimationFrame(() => {
        decision.style.opacity = '1';
        decision.style.transform = 'translateY(0)';
    });

    // Remove after delay
    setTimeout(() => {
        decision.style.opacity = '0';
        decision.style.transform = 'translateY(-20px)';
        setTimeout(() => decision.remove(), 300);
    }, 2000);
}

function handleAIJailTurn(player) {
    console.log(`${player.name} is in Jail. AI is deciding how to proceed.`);

    if (player.jailTurns > 0) {
        // AI decides how to get out of jail
        if (player.money >= 50) {
            // Pay fine if AI has enough money
            player.money -= 50;
            player.inJail = false;
            player.jailTurns = 0;
            showFeedback(`${player.name} paid $50 to get out of Jail.`);
        } else if (player.cards.includes("Get Out of Jail Free")) {
            // Use "Get Out of Jail Free" card if available
            player.cards.splice(player.cards.indexOf("Get Out of Jail Free"), 1);
            player.inJail = false;
            player.jailTurns = 0;
            showFeedback(`${player.name} used a Get Out of Jail Free card.`);
        } else {
            // Roll for doubles
            const roll1 = Math.ceil(Math.random() * 6);
            const roll2 = Math.ceil(Math.random() * 6);
            if (roll1 === roll2) {
                player.inJail = false;
                player.jailTurns = 0;
                showFeedback(`${player.name} rolled doubles and got out of Jail!`);
            } else {
                player.jailTurns -= 1;
                showFeedback(`${player.name} failed to roll doubles. ${player.jailTurns} turn(s) left in Jail.`);
            }
        }
    }

    if (player.jailTurns === 0) {
        player.inJail = false;
        console.log(`${player.name} is released from Jail.`);
    }

    endTurn(); // End the turn after handling jail logic
}

function isCurrentPlayerAI() {
    const currentPlayer = players[currentPlayerIndex];
    if (!currentPlayer) {
        console.error(`No current player found at index ${currentPlayerIndex}`);
        return false;
    }

    // Check both the `isAI` flag and the `aiPlayers` set
    const isAI = currentPlayer.isAI || aiPlayers.has(currentPlayer.tokenName);
    console.log(`Checking if Player ${currentPlayerIndex + 1} (${currentPlayer.name}) is AI: ${isAI}`);
    return isAI;
}

function makeAIBuyDecision(player, property) {
    if (!player || !property) {
        console.error("Invalid player or property in makeAIBuyDecision");
        return false;
    }

    try {
        // Sophisticated AI decision making for purchasing properties
        const factors = {
            hasEnoughMoney: player.money >= (property.price || 0) * 2,
            isGoodValue: (property.price || 0) <= 200,
            hasMonopolyPotential: hasMonopolyPotential(player, property),
            isStrategicLocation: isStrategicLocation(property),
            randomChance: Math.random() > 0.3
        };

        // Weight different factors
        const score = (factors.hasEnoughMoney ? 2 : 0) +
            (factors.isGoodValue ? 1.5 : 0) +
            (factors.hasMonopolyPotential ? 3 : 0) +
            (factors.isStrategicLocation ? 2 : 0) +
            (factors.randomChance ? 0.5 : 0);

        return score >= 4;
    } catch (error) {
        console.error("Error in makeAIBuyDecision:", error);
        return false;
    }
}

function handleFreeParking(player) {
    showFeedback("Free Parking - Take a break!");
    // Add any house rules for Free Parking here
}

function handleUtilityLanding(player, property) {
    if (!property.owner) {
        if (!isCurrentPlayerAI()) {
            showPropertyUI(player.currentPosition);
        }
    } else if (property.owner !== player) {
        const diceRoll = Math.ceil(Math.random() * 6) + Math.ceil(Math.random() * 6);
        const rentAmount = calculateUtilityRent(property, diceRoll);
        showFeedback(`Rolled ${diceRoll} for utility rent`);
        setTimeout(() => payRent(player, property.owner, rentAmount), 1000);
    }
}

function calculateUtilityRent(property, diceRoll) {
    const utilityCount = property.owner.properties.filter(p => p.type === "utility").length;
    return utilityCount === 1 ? diceRoll * 4 : diceRoll * 10;
}

function calculateAndPayRent(player, property) {
    const rentAmount = calculateRent(property);
    payRent(player, property.owner, rentAmount);
}

function calculateRent(property) {
    let rent = property.rent;

    // Check for monopoly
    if (hasMonopoly(property.owner, property)) {
        rent *= 3; // Increase monopoly multiplier from 2 to 3
        console.log(`Rent tripled to $${rent} due to monopoly`);
    }

    // Add house/hotel rents
    if (property.houses > 0) {
        rent = property.rentWithHouse[property.houses - 1] * 1.5; // Increase house rent by 50%
        console.log(`Rent adjusted to $${rent} due to ${property.houses} houses`);
    } else if (property.hotel) {
        rent = property.rentWithHotel * 1.5; // Increase hotel rent by 50%
        console.log(`Rent adjusted to $${rent} due to hotel`);
    }

    return rent;
}

function hasMonopoly(player, property) {
    if (!property.color) return false;

    const sameColorProperties = properties.filter(p => p.color === property.color);
    return sameColorProperties.every(p => p.owner === player);
}

// Helper function to get player colors
function getPlayerColor(playerIndex) {
    const colors = [
        0x00ff00, // Green
        0x0000ff, // Blue
        0xff0000, // Red
        0xffff00 // Yellow
    ];
    return colors[playerIndex] || colors[0];
}


function getTokenImageUrl(tokenName) {
    const imageUrls = {
        "hat": "Images/image-removebg-preview (6).png",
        "woman": "Images/image-removebg-preview (8).png",
        "rolls royce": "Images/image-removebg-preview.png",
        "speed boat": "Images/image-removebg-preview (3).png",
        "football": "Models/wilson_football/image-removebg-preview (7).png",
        "helicopter": "Models/helicopter/image-removebg-preview (1).png",
        "burger": "Images/image-removebg-preview (9).png",
        "nike": "Images/image-removebg-preview (10).png"
    };
    return imageUrls[tokenName] || "";
}

function selectToken(tokenName) {
    scene.traverse((object) => {
        if (object.userData.isToken && object.userData.tokenName === tokenName) {
            selectedToken = object;
            players[currentPlayerIndex].selectedToken = selectedToken;

            object.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.emissiveIntensity = 0.5;
                    child.material.needsUpdate = true;
                }
            });
        }
    });

    if (tokenSelectionUI) {
        tokenSelectionUI.style.opacity = "0";
        tokenSelectionUI.style.transition = "opacity 0.5s";
        setTimeout(() => {
            document.body.removeChild(tokenSelectionUI);
            tokenSelectionUI = null;
        }, 500);
    }

    nextPlayer(); // Call next player here
}

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Main camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);
    camera.position.set(0, 48, 0);
    camera.rotation.x = -Math.PI / 2;

    // Follow camera
    followCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1500);

    renderer = new THREE.WebGLRenderer({
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // Use OrbitControls for the main camera
    controls = new OrbitControls(camera, renderer.domElement);

    setupLighting();
    createBoard();
    createTokens();
    createProperties();

    // Call createImageCarousel here, after the scene is initialized
    createImageCarousel(images, {
        x: 0,
        y: 1.5,
        z: 0
    }); // Position in the middle of the board

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    popupGroup = new THREE.Group();
    scene.add(popupGroup);

    window.addEventListener("click", onTokenClick);
    window.addEventListener("resize", onWindowResize, false);
    window.addEventListener("click", onPropertyClick);

    animate();
    initializePlayers();
    validateGameState();
    createPlayerTokenSelectionUI(currentPlayerIndex);
    createDiceButton();
    startGameTimer();
    updatePropertyManagementBoard(players[currentPlayerIndex]);
}

function createImageCarousel(images, position) {
    if (!scene) {
        console.error("Scene is not initialized. Ensure the scene is created before calling createImageCarousel.");
        return;
    }

    const carouselGroup = new THREE.Group();
    const planeGeometry = new THREE.PlaneGeometry(60, 60);

    let currentImageIndex = 0;
    let carouselTimeout = null;
    let gifImg = null; // For animated GIFs
    let baseplate = null; // <-- Add this line

    // Create a single plane for the carousel
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const plane = new THREE.Mesh(planeGeometry, material);
    plane.rotation.x = -Math.PI / 2;
    carouselGroup.add(plane);

    carouselGroup.position.set(position.x, position.y, position.z);
    scene.add(carouselGroup);

    function spawnBaseplate() {
        if (baseplate) return; // Already exists
        const baseGeometry = new THREE.BoxGeometry(62, 1, 62); // Slightly larger than image
        const baseMaterial = new THREE.MeshPhongMaterial({
            color: 0x222222,
            shininess: 30,
            opacity: 0.85,
            transparent: true
        });
        baseplate = new THREE.Mesh(baseGeometry, baseMaterial);
        baseplate.position.set(
            carouselGroup.position.x,
            carouselGroup.position.y - 1, // Just below the carousel
            carouselGroup.position.z
        );
        baseplate.receiveShadow = true;
        scene.add(baseplate);
    }

    function removeBaseplate() {
        if (baseplate) {
            scene.remove(baseplate);
            baseplate.geometry.dispose();
            baseplate.material.dispose();
            baseplate = null;
        }
    }

    function updateImage() {
        if (carouselTimeout) clearTimeout(carouselTimeout);

        const currentImage = images[currentImageIndex];

        // Remove baseplate by default
        removeBaseplate();

        // If previous GIF image exists, remove its animation loop
        if (gifImg) {
            gifImg = null;
        }

        // If it's a GIF, use <img> so browser animates it
        if (currentImage.endsWith('.gif')) {
            gifImg = document.createElement('img');
            gifImg.src = currentImage;
            gifImg.crossOrigin = "anonymous";
            gifImg.onload = () => {
                const texture = new THREE.Texture(gifImg);
                texture.needsUpdate = true;
                material.map = texture;
                material.needsUpdate = true;

                // Animate the GIF by updating the texture every frame
                function animateGifTexture() {
                    if (material.map && gifImg) {
                        material.map.needsUpdate = true;
                        requestAnimationFrame(animateGifTexture);
                    }
                }
                animateGifTexture();

                // --- SPAWN BASEPLATE ONLY FOR GIF ---
                spawnBaseplate();

                // Set how long to show the GIF (default: 6s, or adjust as needed)
                carouselTimeout = setTimeout(nextImage, 6000);
            };
        } else {
            // For static images, use TextureLoader
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(currentImage, (loadedTexture) => {
                material.map = loadedTexture;
                material.needsUpdate = true;
            });
            carouselTimeout = setTimeout(nextImage, 3000);
        }
    }

    function nextImage() {
        // Remove baseplate when switching away from GIF
        removeBaseplate();
        currentImageIndex = (currentImageIndex + 1) % images.length;
        updateImage();
    }

    updateImage();
}

function checkGameEnd() {
    let activePlayers = players.filter(player => player.money > 0).length;

    if (activePlayers <= 1) {
        alert("Game Over! " + players.find(player => player.money > 0).name + " wins!");
        resetGame();
    }
}

function resetGame() {
    players.forEach(player => {
        player.money = 1500;
        player.properties = [];
        player.currentPosition = 0;
        player.tokenName = null;
        player.selectedToken = null;
    });
    startGame(); // Redirect to the home screen or restart the game
}

function startGame() {
    window.location.href = 'home.html'; // Redirects back to home screen
}

function checkBankruptcy(player) {
    if (player.money < 0) {
        alert(`${player.name} is bankrupt and out of the game!`);
        players = players.filter(p => p !== player);
        if (players.length === 1) {
            alert(`Game Over! ${players[0].name} wins!`);
            resetGame();
        }
    }
}

function tradeProperty(fromPlayer, toPlayer, property, amount) {
    if (fromPlayer.properties.includes(property) && toPlayer.money >= amount) {
        fromPlayer.properties.splice(fromPlayer.properties.indexOf(property), 1);
        fromPlayer.money += amount;
        toPlayer.properties.push(property);
        toPlayer.money -= amount;
        alert(`${toPlayer.name} bought ${property.name} from ${fromPlayer.name} for $${amount}`);
        updateMoneyDisplay();
    }
}

function mortgageProperty(player, property) {
    if (property.houses > 0 || property.hotel) {
        showFeedback("Sell all houses and hotels before mortgaging this property!");
        return;
    }

    if (!property.mortgaged) {
        player.money += property.mortgageValue;
        property.mortgaged = true;
        showFeedback(`${property.name} has been mortgaged for $${property.mortgageValue}`);
        updateMoneyDisplay();
        updatePropertyManagementBoard(player);
    }
}

function goToJail(player) {
    const jailPosition = placeNames.findIndex(name => name === "JAIL");
    player.currentPosition = jailPosition;
    player.inJail = true;
    player.jailTurns = 2; // Stay in jail for 2 turns

    showFeedback(`${player.name} is sent to Jail!`);
    endTurn(); // End the turn immediately
}

function useGetOutOfJailFreeCard(player) {
    const card = player.cards.find(c => c === "Get Out of Jail Free");
    if (card) {
        player.cards.splice(player.cards.indexOf(card), 1);
        player.inJail = false;
        alert(`${player.name} used a Get Out of Jail Free card`);
    }
}

function createTradeUI() {
    const tradeUI = document.getElementById("trade-ui");
    const fromPlayerSelect = document.getElementById("from-player-select");
    const toPlayerSelect = document.getElementById("to-player-select");

    fromPlayerSelect.innerHTML = players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
    toPlayerSelect.innerHTML = players.map(p => `<option value="${p.name}">${p.name}</option>`).join('');

    document.getElementById("trade-button").onclick = () => {
        const fromPlayerName = fromPlayerSelect.value;
        const toPlayerName = toPlayerSelect.value;
        const fromPlayer = players.find(p => p.name === fromPlayerName);
        const toPlayer = players.find(p => p.name === toPlayerName);

        // Example trade logic, replace with more complex logic as needed
        const tradeSuccessful = tradeProperty(fromPlayer, toPlayer, fromPlayer.properties[0], 100);
        const tradeStatus = document.getElementById("trade-status");
        tradeStatus.textContent = tradeSuccessful ? "Trade Successful!" : "Trade Failed!";
    };

    tradeUI.style.display = "block";
}

function createMortgageUI() {
    const propertyUI = getPropertyUI(); // Assume this function gets the relevant property UI element

    const mortgageButton = document.createElement("button");
    mortgageButton.textContent = "Mortgage Property";
    mortgageButton.onclick = () => {
        const currentPlayer = players[currentPlayerIndex];
        const property = currentPlayer.properties[0]; // Assume a method to get the selected property
        mortgageProperty(currentPlayer, property);
    };

    const unmortgageButton = document.createElement("button");
    unmortgageButton.textContent = "Unmortgage Property";
    unmortgageButton.onclick = () => {
        const currentPlayer = players[currentPlayerIndex];
        const property = currentPlayer.properties[0]; // Assume a method to get the selected property
        unmortgageProperty(currentPlayer, property);
    };

    propertyUI.appendChild(mortgageButton);
    propertyUI.appendChild(unmortgageButton);
}

function onPlayerTurn() {
    const currentPlayer = players[currentPlayerIndex];

    console.log(`It's ${currentPlayer.name}'s turn!`);

    // Display Jail Options if the player is in jail
    if (currentPlayer.inJail) {
        createJailOptionsUI(currentPlayer);
    } else {
        // Check if player is on a property space and handle property-specific actions
        const currentSpace = positions[currentPlayer.currentPosition];
        const positionIndex = positions.indexOf(currentSpace);
        const placeName = placeNames[positionIndex];
        const property = properties.find(p => p.name === placeName);

        if (property && property.videoUrls && property.videoUrls.length > 0) {
            const videoContainer = document.createElement('div');
            videoContainer.className = 'property-video-container';
            videoContainer.style.width = '200px';
            videoContainer.style.height = '150px';
            videoContainer.style.overflow = 'hidden';
            videoContainer.style.borderRadius = '8px';
            videoContainer.style.marginBottom = '10px';
            videoContainer.style.position = 'relative';

            // Randomly select one of the video URLs
            const randomIndex = Math.floor(Math.random() * property.videoUrls.length);
            const selectedUrl = property.videoUrls[randomIndex];

            const video = document.createElement('video');
            video.src = selectedUrl;
            video.controls = true;
            video.autoplay = false;
            video.muted = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'cover';

            videoContainer.appendChild(video);
            content.appendChild(videoContainer);
        } else {
            // Handle property UI and other space specific logic
            showPropertyUI(currentPlayer.currentPosition);
        }
    }

    // Offer trade options
    if (currentPlayer.properties.length > 0) {
        createTradeUI();
    }

    // Check for things like "Go to Jail" spaces
    if (placeNames[currentPlayer.currentPosition] === "GO TO JAIL") {
        goToJail(currentPlayer);
    }
}


// Add these functions to implement complete Monopoly money system

function handlePassingGo(player) {
    player.money += 400; // Increased from $200 to $400
    showFeedback(`${player.name} passed GO! Collected $400`);
    updateMoneyDisplay();
}

function checkPassingGo(oldPosition, newPosition) {
    // Check if player passed GO by comparing old and new positions
    if (oldPosition > newPosition) {
        return true;
    }
    return false;
}

function handleBankruptcy(bankruptPlayer, creditorPlayer, amountOwed) {
    showFeedback(`${bankruptPlayer.name} is bankrupt!`);

    // Transfer all properties to creditor
    bankruptPlayer.properties.forEach(property => {
        property.owner = creditorPlayer;
        creditorPlayer.properties.push(property);
    });

    // Transfer all money
    creditorPlayer.money += bankruptPlayer.money;
    bankruptPlayer.money = 0;

    // Remove bankrupt player from game
    players = players.filter(p => p !== bankruptPlayer);

    checkGameEnd();
}

const DICE_POSITION = {
    x: 0, // Center of board
    y: 1.5, // Just above board surface
    z: 0 // Center of board
};

function createDiceButton() {
    if (!document.querySelector('.dice-button')) {
        const rollButton = document.createElement('button');
        rollButton.className = 'dice-button';
        rollButton.textContent = 'Roll Dice';

        // Only set display and z-index, let CSS handle the rest
        rollButton.style.display = 'none';
        rollButton.style.zIndex = '2001'; // Make sure it's above most UI

        // Touch and click support
        rollButton.addEventListener('click', rollDice);
        rollButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            rollDice();
        });

        document.body.appendChild(rollButton);
    }
}

function createDie(number) {
    const dieGeometry = new THREE.BoxGeometry(2, 2, 2);
    const materials = [];

    // Create all 6 faces
    for (let i = 0; i < 6; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const context = canvas.getContext('2d');

        // White background
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, 128, 128);
        context.fillStyle = '#000000';

        // Draw dots ONLY for the number we want (front face)
        if (i === 0) {
            drawDots(context, number);
        }

        const texture = new THREE.CanvasTexture(canvas);
        materials.push(new THREE.MeshBasicMaterial({
            map: texture
        }));
    }

    const die = new THREE.Mesh(dieGeometry, materials);
    die.castShadow = true;
    return die;
}

function drawDots(context, number) {
    const positions = {
        1: [
            [64, 64]
        ],
        2: [
            [32, 32],
            [96, 96]
        ],
        3: [
            [32, 32],
            [64, 64],
            [96, 96]
        ],
        4: [
            [32, 32],
            [32, 96],
            [96, 32],
            [96, 96]
        ],
        5: [
            [32, 32],
            [32, 96],
            [64, 64],
            [96, 32],
            [96, 96]
        ],
        6: [
            [32, 32],
            [32, 64],
            [32, 96],
            [96, 32],
            [96, 64],
            [96, 96]
        ]
    };

    const dots = positions[number] || [];
    dots.forEach(([x, y]) => {
        context.beginPath();
        context.arc(x, y, 10, 0, Math.PI * 2);
        context.fill();
    });
}

function rollDice() {
    if (!allowedToRoll || isTokenMoving || isTurnInProgress) {
        console.log("Cannot roll dice while token is moving or turn is in progress.");
        return;
    }

    allowedToRoll = false; // Prevent further rolls until this one is done
    isTurnInProgress = true; // Mark the turn as in progress
    hasTakenAction = true; // Mark that the player has taken an action

    // Create dice rolling sound
    const rollSound = new Audio('Sounds/dice-142528.mp3');
    rollSound.volume = 0.5;
    rollSound.play().catch(error => console.log("Audio play failed:", error));

    // Generate the roll numbers
    const roll1 = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const total = roll1 + roll2;
    console.log(`Dice rolled: ${roll1} and ${roll2} (Total: ${total})`);

    // Create dice with these numbers
    const dice1 = createDie(roll1);
    const dice2 = createDie(roll2);

    // Position dice
    dice1.position.set(DICE_POSITION.x - 2, DICE_POSITION.y, DICE_POSITION.z);
    dice2.position.set(DICE_POSITION.x + 2, DICE_POSITION.y, DICE_POSITION.z);

    scene.add(dice1);
    scene.add(dice2);

    let rotations = 0;
    const maxRotations = 5;

    const animate = () => {
        if (rotations < maxRotations) {
            // Random rotations during animation
            dice1.rotation.x += Math.random() * 0.3;
            dice1.rotation.y += Math.random() * 0.3;
            dice1.rotation.z += Math.random() * 0.3;
            dice2.rotation.x += Math.random() * 0.3;
            dice2.rotation.y += Math.random() * 0.3;
            dice2.rotation.z += Math.random() * 0.3;
            rotations += 0.1;
            requestAnimationFrame(animate);
        } else {
            // Final rotation to show numbers on top
            dice1.rotation.set(0, 0, Math.PI / 2);
            dice2.rotation.set(0, 0, Math.PI / 2);

            // Show the dice result
            showDiceResult(total, roll1, roll2);

            setTimeout(() => {
                // Remove dice from the scene
                scene.remove(dice1);
                scene.remove(dice2);

                // Move the token to the new position
                moveTokenToNewPosition(total, () => {
                    isTurnInProgress = false; // Reset the flag after movement is complete
                });
            }, 3000);
        }
    };

    animate();
}

function logTurnDetails() {
    console.log(`Current Player: ${players[currentPlayerIndex].name}`);
    console.log(`isTurnInProgress: ${isTurnInProgress}`);
    console.log(`allowedToRoll: ${allowedToRoll}`);
}

function handlePlayerInJail(player) {
    if (player.jailTurns > 0) {
        console.log(`${player.name} is in Jail. Skipping turn.`);
        player.jailTurns -= 1;

        if (player.jailTurns === 0) {
            player.inJail = false; // Release the player after their jail turns are over
            console.log(`${player.name} is released from Jail.`);
        }

        setTimeout(() => {
            isTurnInProgress = false; // Mark the turn as complete
            endTurn(); // Skip the turn automatically
        }, 2000);
    }
}

function moveTokenToNewPosition(spaces, callback) {
    const currentPlayer = players[currentPlayerIndex];

    if (!currentPlayer.selectedToken) {
        console.error(`No token assigned to ${currentPlayer.name}.`);
        return;
    }

    const oldPosition = currentPlayer.currentPosition;
    const propertiesCount = positions.length;
    const newPosition = (oldPosition + spaces + propertiesCount) % propertiesCount;

    const token = currentPlayer.selectedToken;
    const startPos = positions[oldPosition];
    const endPos = positions[newPosition];

    if (token.userData.tokenName === "football") {
        // Use the throwFootballAnimation for the entire movement
        const finalHeight = getTokenHeight(token.userData.tokenName, endPos.y) + 1.0; // Add height for the throw
        throwFootballAnimation(token, endPos, finalHeight, () => {
            finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
            if (callback) callback();
        });
    } else {
        // Default behavior for other tokens
        let currentSpace = oldPosition;

        function moveOneSpace() {
            if (currentSpace === newPosition) {
                finishMove(currentPlayer, newPosition, oldPosition + spaces >= propertiesCount);
                if (callback) callback();
                return;
            }

            const nextSpace = (currentSpace + 1) % propertiesCount;
            const startPos = positions[currentSpace];
            const endPos = positions[nextSpace];

            moveToken(startPos, endPos, token, () => {
                currentSpace = nextSpace;
                moveOneSpace();
            });
        }

        moveOneSpace();
    }
}

function showDiceResult(total, roll1, roll2) {
    const resultDisplay = document.createElement('div');
    resultDisplay.className = 'dice-result';
    const article = [8, 11, 18].includes(total) ? 'an' : 'a';
    resultDisplay.textContent = `${isCurrentPlayerAI() ? 'AI ' : ''}Rolled ${article} ${total}!`;
    document.body.appendChild(resultDisplay);

    setTimeout(() => {
        resultDisplay.classList.add('show');
        setTimeout(() => {
            resultDisplay.remove();
        }, 2000);
    }, 100);
}

// Modify your initPlayerTokenSelection function to create the dice button
const originalInitPlayerTokenSelection = initPlayerTokenSelection;
initPlayerTokenSelection = function() {
    originalInitPlayerTokenSelection();
    createDiceButton();
};

// Modify endTurn to reset dice rolling permission
const originalEndTurn = endTurn;
endTurn = function() {
    allowedToRoll = true;
    originalEndTurn();
};

function showFeedback(message, duration = 2000) {
    const feedbackElement = document.createElement('div');
    feedbackElement.className = 'feedback-message';
    feedbackElement.textContent = message;
    document.body.appendChild(feedbackElement);

    // Animate feedback appearance
    requestAnimationFrame(() => {
        feedbackElement.style.opacity = '1';
        feedbackElement.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        feedbackElement.classList.add('fade-out');
        setTimeout(() => {
            if (feedbackElement.parentElement) {
                feedbackElement.parentElement.removeChild(feedbackElement);
            }
        }, 300);
    }, duration);
}

let gameStartTime = null; // Track the start time of the game
const WINNING_AMOUNT = 10000; // Amount to win the game

function applyRandomEvent(player) {
    const randomEvent = Math.random();
    if (randomEvent < 0.1) {
        player.money += 2000; // Increased from $1,000 to $2,000
        showFeedback(`${player.name} won a $2,000 jackpot!`);
    } else if (randomEvent < 0.2) {
        player.money -= 1000; // Increased penalty from $500 to $1,000
        showFeedback(`${player.name} lost $1,000 in a bad investment.`);
    }
}

function startGameTimer() {
    gameStartTime = Date.now();

    // Periodically check for win conditions
    const interval = setInterval(() => {
        const elapsedTime = Date.now() - gameStartTime;

        // Check if any player has reached $10,000
        const millionaire = players.find(player => player.money >= WINNING_AMOUNT);
        if (millionaire) {
            clearInterval(interval);
            declareWinner(millionaire, "reached $10,000!");
            return;
        }
    }, 1000); // Check every second
}

function declareWinner(winner, reason) {
    alert(`Game Over! ${winner.name} wins because they ${reason}`);
    resetGame();
}

properties.forEach(property => {
    if (property.housePrice) {
        property.housePrice *= 2; // Double the cost of houses
    }
    if (property.hotelPrice) {
        property.hotelPrice *= 2; // Double the cost of hotels
    }
});

function unmortgageProperty(player, property) {
    const unmortgageCost = property.mortgageValue * 1.1; // 10% interest
    if (player.money >= unmortgageCost && property.mortgaged) {
        player.money -= unmortgageCost;
        property.mortgaged = false;
        showNotification(`${property.name} has been unmortgaged for $${unmortgageCost}`);
        updateMoneyDisplay();
        updatePropertyManagementBoard(player);
    } else {
        showNotification("Not enough money to unmortgage this property!");
    }
}

function showNotification(message) {
    const notification = document.createElement("div");
    notification.className = "notification";
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.classList.add("show");
    }, 100);

    setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

function updateOtherPlayersBoard(currentPlayer) {
    const otherPlayersList = document.getElementById("other-players-list");
    otherPlayersList.innerHTML = "";

    players.forEach(player => {
        if (player !== currentPlayer) {
            player.properties.forEach(property => {
                const propertyItem = document.createElement("div");
                propertyItem.className = "other-property-item";

                const propertyName = document.createElement("h3");
                propertyName.textContent = property.name;
                propertyItem.appendChild(propertyName);

                const ownerInfo = document.createElement("p");
                ownerInfo.textContent = `Owned by: ${player.name}`;
                propertyItem.appendChild(ownerInfo);

                // Mortgage status INSIDE action group
                const actions = document.createElement("div");
                actions.className = "action-group";
                const mortgageInfo = document.createElement("button");
                mortgageInfo.textContent = property.mortgaged ? "Mortgaged" : "Not Mortgaged";
                mortgageInfo.className = "status-btn";
                mortgageInfo.disabled = true;
                actions.appendChild(mortgageInfo);

                propertyItem.appendChild(actions);

                otherPlayersList.appendChild(propertyItem);
            });
        }
    });
}

function eliminatePlayer(player) {
    showFeedback(`${player.name} has been eliminated from the game!`);

    // Transfer properties to the bank or auction them
    player.properties.forEach(property => {
        property.owner = null; // Reset ownership
        property.mortgaged = false; // Unmortgage properties
    });

    // Remove player from the game
    players = players.filter(p => p !== player);

    // Check if only one player remains
    if (players.length === 1) {
        declareWinner(players[0], "eliminated all other players!");
    }
}

function upgradeProperty(player, property) {
    if (!property.owner || property.owner !== player) {
        showFeedback("You don't own this property!");
        return;
    }

    if (property.houses < 4) {
        if (player.money >= property.housePrice) {
            player.money -= property.housePrice;
            property.houses += 1;
            showFeedback(`Built a house on ${property.name}. Rent increased!`);
        } else {
            showFeedback("Not enough money to build a house!");
        }
    } else if (!property.hotel) {
        if (player.money >= property.hotelPrice) {
            player.money -= property.hotelPrice;
            property.hotel = true;
            property.houses = 0; // Replace houses with a hotel
            showFeedback(`Built a hotel on ${property.name}. Rent maximized!`);
        } else {
            showFeedback("Not enough money to build a hotel!");
        }
    } else {
        showFeedback("This property already has a hotel!");
    }

    updateMoneyDisplay();
    updatePropertyManagementBoard(player);
}

function handleIncomeTax(player) {
    // Calculate 10% of the player's total worth
    const totalWorth = player.money + player.properties.reduce((sum, property) => sum + (property.price || 0), 0);
    const tenPercentTax = Math.floor(totalWorth * 0.1);

    if (isCurrentPlayerAI()) {
        // AI logic for Income Tax
        console.log(`${player.name} (AI) landed on Income Tax.`);

        // AI decision-making: Choose the cheaper option
        if (player.money >= 200 && (200 <= tenPercentTax || player.money < tenPercentTax)) {
            player.money -= 200;
            console.log(`${player.name} (AI) chose to pay $200 in Income Tax.`);
            showFeedback(`${player.name} (AI) paid $200 in Income Tax.`);
        } else if (player.money >= tenPercentTax) {
            player.money -= tenPercentTax;
            console.log(`${player.name} (AI) chose to pay $${tenPercentTax} (10% of total worth) in Income Tax.`);
            showFeedback(`${player.name} (AI) paid $${tenPercentTax} in Income Tax.`);
        } else {
            console.log(`${player.name} (AI) doesn't have enough money to pay Income Tax!`);
            showFeedback(`${player.name} (AI) couldn't afford Income Tax.`);
            handleBankruptcy(player, null); // Handle bankruptcy if AI can't pay
        }

        updateMoneyDisplay();
        setTimeout(() => endTurn(), 1000); // End AI's turn after paying
    } else {
        // Human player UI
        const overlay = document.createElement('div');
        overlay.className = 'income-tax-overlay';

        const popup = document.createElement('div');
        popup.className = 'income-tax-popup';

        const header = document.createElement('div');
        header.className = 'popup-header';
        header.textContent = 'Income Tax';

        const message = document.createElement('div');
        message.className = 'income-tax-message';
        message.textContent = `${player.name}, you must pay $200 or 10% of your total worth.`;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';

        // Button to pay $200
        const pay200Button = document.createElement('button');
        pay200Button.className = 'action-button pay';
        pay200Button.textContent = 'Pay $200';
        pay200Button.onclick = () => {
            if (player.money >= 200) {
                player.money -= 200;
                showFeedback(`${player.name} paid $200 in Income Tax.`);
                updateMoneyDisplay();
            } else {
                showFeedback("Not enough money to pay $200!");
            }
            closePopup(overlay);
            endTurn(); // End the turn after the player makes a decision
        };

        // Button to pay 10% of total worth
        const pay10PercentButton = document.createElement('button');
        pay10PercentButton.className = 'action-button pay';
        pay10PercentButton.textContent = `Pay 10% ($${tenPercentTax})`;
        pay10PercentButton.onclick = () => {
            if (player.money >= tenPercentTax) {
                player.money -= tenPercentTax;
                showFeedback(`${player.name} paid $${tenPercentTax} in Income Tax.`);
                updateMoneyDisplay();
            } else {
                showFeedback("Not enough money to pay 10%!");
            }
            closePopup(overlay);
            endTurn(); // End the turn after the player makes a decision
        };

        // Add buttons to the container
        buttonContainer.appendChild(pay200Button);
        buttonContainer.appendChild(pay10PercentButton);

        // Add header, message, and buttons to the popup
        popup.appendChild(header);
        popup.appendChild(message);
        popup.appendChild(buttonContainer);

        // Add the popup to the overlay
        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Add fade-in animation
        requestAnimationFrame(() => {
            popup.classList.add('fade-in');
        });
    }
}

function closePopup(overlay) {
    if (!overlay) {
        console.error("closePopup called with an invalid overlay.");
        return;
    }
    overlay.classList.add('fade-out');
    setTimeout(() => {
        if (overlay.parentElement) {
            overlay.parentElement.removeChild(overlay);
        }
    }, 300);
}

function showFreeParkingUI(player) {
    // Check if current player is AI first
    if (isCurrentPlayerAI()) {
        console.log("AI landed on Free Parking. Taking a break.");
        showFeedback("AI landed on Free Parking");
        setTimeout(() => endTurn(), 1500);
        return;
    }

    // Create the overlay
    const overlay = document.createElement('div');
    overlay.className = 'free-parking-overlay';

    // Create the popup
    const popup = document.createElement('div');
    popup.className = 'free-parking-popup';

    // Create a container for the video and content
    const contentContainer = document.createElement('div');
    contentContainer.className = 'free-parking-content-container';
    contentContainer.style.display = 'flex';
    contentContainer.style.gap = '20px';

    // Add video container on the left
    const videoContainer = document.createElement('div');
    videoContainer.className = 'free-parking-video-container';
    videoContainer.style.width = '40vw'; // Responsive width
    videoContainer.style.maxWidth = '500px';
    videoContainer.style.height = '28vw'; // Responsive height
    videoContainer.style.maxHeight = '350px';
    videoContainer.style.minWidth = '220px';
    videoContainer.style.minHeight = '150px';
    videoContainer.style.overflow = 'hidden';
    videoContainer.style.borderRadius = '8px';
    videoContainer.style.display = 'flex';
    videoContainer.style.alignItems = 'center';
    videoContainer.style.justifyContent = 'center';

    // Add a single randomized Free Parking video
    const freeParkingVideos = [
    ];
    const randomVideo = freeParkingVideos[Math.floor(Math.random() * freeParkingVideos.length)];

    const video = document.createElement('video');
    video.src = randomVideo;
    video.controls = true;
    video.autoplay = true;
    video.muted = true; // Start muted
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    video.style.borderRadius = '8px';
    video.style.background = '#000';
    video.style.display = 'block';

    // Responsive adjustment for small screens
    const style = document.createElement('style');
    style.textContent = `
        @media (max-width: 700px) {
            .free-parking-video-container {
                width: 90vw !important;
                height: 40vw !important;
                max-width: 98vw !important;
                max-height: 50vw !important;
            }
        }
    `;
    document.head.appendChild(style);

    // Unmute the video when it is loaded
    video.addEventListener('loadeddata', () => {
        video.muted = false; // Unmute the video
        video.play().catch(error => console.error("Failed to play video:", error));
    });

    videoContainer.appendChild(video);

    // Add content container on the right
    const content = document.createElement('div');
    content.className = 'free-parking-content';
    content.style.flex = '1';

    // Add header
    const header = document.createElement('div');
    header.className = 'popup-header';
    header.textContent = 'Free Parking';
    header.style.backgroundColor = '#4CAF50';
    header.style.color = 'white';
    header.style.padding = '15px';
    header.style.borderRadius = '8px 8px 0 0';

    // Add message
    const message = document.createElement('div');
    message.className = 'free-parking-message';
    message.textContent = `${player.name}, enjoy your break! Take a moment to rest and plan your next moves.`;
    message.style.padding = '20px';
    message.style.fontSize = '18px';
    message.style.lineHeight = '1.5';

    // Add button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'button-container';
    buttonContainer.style.padding = '20px';
    buttonContainer.style.textAlign = 'center';

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'action-button close';
    closeButton.textContent = 'Continue Game';
    closeButton.style.padding = '12px 24px';
    closeButton.style.fontSize = '16px';
    closeButton.onclick = () => {
        closePopup(overlay);
        endTurn();
    };
    buttonContainer.appendChild(closeButton);

    // Assemble the content
    content.appendChild(header);
    content.appendChild(message);
    content.appendChild(buttonContainer);

    // Add video and content to the container
    contentContainer.appendChild(videoContainer);
    contentContainer.appendChild(content);

    // Add the content container to the popup
    popup.appendChild(contentContainer);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Add fade-in animation
    requestAnimationFrame(() => {
        popup.classList.add('fade-in');
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
        if (overlay.parentElement) {
            closePopup(overlay);
            endTurn();
        }
    }, 10000);
}

function handleLuxuryTax(player) {
    const luxuryTaxAmount = 100; // Fixed luxury tax amount

    if (isCurrentPlayerAI()) {
        // AI logic for Luxury Tax
        console.log(`${player.name} (AI) landed on Luxury Tax.`);

        if (player.money >= luxuryTaxAmount) {
            player.money -= luxuryTaxAmount;
            console.log(`${player.name} (AI) paid $${luxuryTaxAmount} in Luxury Tax.`);
            showFeedback(`${player.name} (AI) paid $${luxuryTaxAmount} in Luxury Tax.`);
        } else {
            console.log(`${player.name} (AI) doesn't have enough money to pay Luxury Tax!`);
            showFeedback(`${player.name} (AI) couldn't afford Luxury Tax.`);
            handleBankruptcy(player, null); // Handle bankruptcy if AI can't pay
        }

        updateMoneyDisplay();
        setTimeout(() => endTurn(), 1000); // End AI's turn after paying
    } else {
        // Human player UI
        const overlay = document.createElement('div');
        overlay.className = 'luxury-tax-overlay';

        const popup = document.createElement('div');
        popup.className = 'luxury-tax-popup';

        const header = document.createElement('div');
        header.className = 'popup-header';
        header.textContent = 'Luxury Tax';

        const message = document.createElement('div');
        message.className = 'luxury-tax-message';
        message.textContent = `${player.name}, you must pay $${luxuryTaxAmount}.`;

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'button-container';

        // Button to pay Luxury Tax
        const payButton = document.createElement('button');
        payButton.className = 'action-button pay';
        payButton.textContent = `Pay $${luxuryTaxAmount}`;
        payButton.onclick = () => {
            if (player.money >= luxuryTaxAmount) {
                player.money -= luxuryTaxAmount;
                showFeedback(`${player.name} paid $${luxuryTaxAmount} in Luxury Tax.`);
                updateMoneyDisplay();
            } else {
                showFeedback("Not enough money to pay Luxury Tax!");
            }
            closePopup(overlay);
            endTurn(); // End the turn after the player makes a decision
        };

        // Add button to the container
        buttonContainer.appendChild(payButton);

        // Add header, message, and buttons to the popup
        popup.appendChild(header);
        popup.appendChild(message);
        popup.appendChild(buttonContainer);

        // Add the popup to the overlay
        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        // Add fade-in animation
        requestAnimationFrame(() => {
            popup.classList.add('fade-in');
        });
    }
}

function validateTurnProgression() {
    const currentPlayer = players[currentPlayerIndex];
    let isValid = true;
    let errorMessages = [];

    try {
        // 1. Basic player validation
        if (!currentPlayer) {
            errorMessages.push("Invalid current player");
            isValid = false;
        }

        // 2. Turn state validation
        if (isTurnInProgress) {
            errorMessages.push("Turn is already in progress");
            isValid = false;
        }

        // 3. Action validation for non-jailed players
        if (!currentPlayer.inJail) {
            if (!hasRolledDice && !isCurrentPlayerAI()) {
                errorMessages.push("Dice have not been rolled yet");
                isValid = false;
            }

            if (hasRolledDice && !hasMovedToken) {
                errorMessages.push("Token movement not completed");
                isValid = false;
            }
        }

        // 4. AI-specific validation
        if (isCurrentPlayerAI() && isAIProcessing) {
            errorMessages.push("AI is still processing its turn");
            isValid = false;
        }

        // 5. Property handling validation
        if (hasMovedToken && !hasHandledProperty && !currentPlayer.inJail) {
            errorMessages.push("Property has not been handled yet");
            isValid = false;
        }

        // 6. Special space validation
        const currentSpace = placeNames[currentPlayer.currentPosition];
        if (currentSpace === "Chance" || currentSpace === "Community Cards") {
            if (!hasDrawnCard && hasMovedToken) {
                errorMessages.push("Card has not been drawn yet");
                isValid = false;
            }
        }

        // 7. Turn order validation
        if (lastPlayerIndex !== -1) {
            const expectedPlayerIndex = (lastPlayerIndex + 1) % players.length;
            if (currentPlayerIndex !== expectedPlayerIndex && !currentPlayer.inJail) {
                errorMessages.push(`Invalid turn order. Expected Player ${expectedPlayerIndex + 1}`);
                isValid = false;
            }
        }

        // Log validation results
        if (!isValid) {
            console.warn("Turn validation failed:", errorMessages);
            showFeedback("Please complete all required actions before ending turn");
        }

        // Return validation state and messages
        return {
            isValid,
            errors: errorMessages,
            currentState: {
                playerIndex: currentPlayerIndex,
                playerName: currentPlayer?.name,
                position: currentPlayer?.currentPosition,
                hasRolled: hasRolledDice,
                hasMoved: hasMovedToken,
                hasHandledProperty: hasHandledProperty,
                isInJail: currentPlayer?.inJail,
                isAI: isCurrentPlayerAI(),
                turnCounter: turnCounter
            }
        };

    } catch (error) {
        console.error("Error in validateTurnProgression:", error);
        return {
            isValid: false,
            errors: ["Critical validation error occurred"],
            currentState: null
        };
    }
}

function updatePropertyManagementBoard(player) {
    const propertyList = document.getElementById("property-list");
    propertyList.innerHTML = ""; // Clear the list

    player.properties.forEach(property => {
        const propertyItem = document.createElement("div");
        propertyItem.className = "property-item";

        const propertyName = document.createElement("h3");
        propertyName.textContent = property.name;
        propertyItem.appendChild(propertyName);

        // START: Group action buttons
        const actions = document.createElement("div");
        actions.className = "action-group";

        // Mortgage/unmortgage button
        const actionButton = document.createElement("button");
        if (property.mortgaged) {
            actionButton.textContent = "Unmortgage";
            actionButton.className = "unmortgage";
            actionButton.disabled = player !== players[currentPlayerIndex];
            actionButton.onclick = () => unmortgageProperty(player, property);
        } else {
            actionButton.textContent = "Mortgage";
            actionButton.className = "mortgage";
            actionButton.disabled = player !== players[currentPlayerIndex];
            actionButton.onclick = () => mortgageProperty(player, property);
        }
        actions.appendChild(actionButton);

        // If you want to add more actions, add more buttons here...

        propertyItem.appendChild(actions);
        // END: Group action buttons

        propertyList.appendChild(propertyItem);
    });
}

// Helper function to check if all required actions are completed
function areAllRequiredActionsCompleted() {
    const validation = validateTurnProgression();
    return validation.isValid;
}

// Use this in endTurn and other critical points
function canProcessTurn() {
    const validation = validateTurnProgression();
    if (!validation.isValid) {
        console.log("Turn cannot proceed:", validation.errors);
        return false;
    }
    return true;
}

// Add this to your error handling
function handleTurnError(error) {
    console.error("Turn error occurred:", error);
    const validation = validateTurnProgression();
    console.log("Current turn state:", validation.currentState);
    
    // Reset critical flags if needed
    isTurnInProgress = false;
    isAIProcessing = false;
    
    // Show feedback to user
    showFeedback("An error occurred. Please try again.");
}

function showSuggestionNotification() {
    // Prevent multiple notifications stacking
    if (document.getElementById("suggestion-notification")) return;

    const notif = document.createElement("div");
    notif.id = "suggestion-notification";
    notif.textContent = "Email: Maurice13stu@gmail.com for suggestions";
    notif.style.position = "fixed";
    notif.style.bottom = "30px";
    notif.style.right = "30px";
    notif.style.background = "rgba(40,40,40,0.95)";
    notif.style.color = "#fff";
    notif.style.padding = "16px 28px";
    notif.style.borderRadius = "8px";
    notif.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)";
    notif.style.fontSize = "16px";
    notif.style.zIndex = "9999";
    notif.style.opacity = "0";
    notif.style.transition = "opacity 0.4s";

    document.body.appendChild(notif);
    setTimeout(() => notif.style.opacity = "1", 50);

    setTimeout(() => {
        notif.style.opacity = "0";
        setTimeout(() => notif.remove(), 400);
    }, 5000); // Show for 5 seconds
}

function setupPropertiesToggleButton() {
    // Only add if not already present (prevents duplicates)
    if (document.getElementById('properties-toggle-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'properties-toggle-btn';
    btn.innerText = 'My Properties'; // Remove emoji, make text short

    // Make button smaller for mobile (handled by CSS, but also set here for initial render)
    btn.style.fontSize = '14px';
    btn.style.padding = '10px 14px';
    btn.style.borderRadius = '8px';
    btn.style.minWidth = '90px';
    btn.style.maxWidth = '130px';
    btn.style.width = 'auto';

    document.body.appendChild(btn);

    btn.addEventListener('click', function () {
        const myBoard = document.getElementById('property-management-board');
        const otherBoard = document.getElementById('other-players-board');

        const visible = myBoard.classList.contains('board-visible');
        if (visible) {
            myBoard.classList.remove('board-visible');
            otherBoard.classList.remove('board-visible');
            btn.innerText = 'My Properties';
        } else {
            myBoard.classList.add('board-visible');
            otherBoard.classList.add('board-visible');
            btn.innerText = 'Hide Properties';
        }
    });
}

// Show every 4 minutes (240000 ms)
setInterval(showSuggestionNotification, 240000);

// Optionally, show once shortly after page load
setTimeout(showSuggestionNotification, 10000);

/*
// Function to create a UI for testing mode
function createTestingModeUI() {
    const testingModeContainer = document.createElement('div');
    testingModeContainer.id = 'testing-mode-container';
    testingModeContainer.style.position = 'fixed';
    testingModeContainer.style.top = '20px';
    testingModeContainer.style.right = '20px';
    testingModeContainer.style.width = '300px';
    testingModeContainer.style.padding = '10px';
    testingModeContainer.style.backgroundColor = '#333';
    testingModeContainer.style.color = '#fff';
    testingModeContainer.style.borderRadius = '8px';
    testingModeContainer.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    testingModeContainer.style.zIndex = '1000';

    const title = document.createElement('h3');
    title.textContent = 'Testing Mode';
    title.style.marginBottom = '10px';
    testingModeContainer.appendChild(title);

    const propertySelect = document.createElement('select');
    propertySelect.style.width = '100%';
    propertySelect.style.padding = '5px';
    propertySelect.style.marginBottom = '10px';
    propertySelect.style.borderRadius = '4px';
    propertySelect.style.border = '1px solid #ccc';

    // Populate the dropdown with place names
    placeNames.forEach((placeName, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = placeName;
        propertySelect.appendChild(option);
    });

    testingModeContainer.appendChild(propertySelect);

    const testButton = document.createElement('button');
    testButton.textContent = 'Show Property UI';
    testButton.style.width = '100%';
    testButton.style.padding = '10px';
    testButton.style.border = 'none';
    testButton.style.borderRadius = '4px';
    testButton.style.backgroundColor = '#4CAF50';
    testButton.style.color = '#fff';
    testButton.style.cursor = 'pointer';

    testButton.onclick = () => {
        const selectedIndex = parseInt(propertySelect.value, 10);
        if (!isNaN(selectedIndex) && placeNames[selectedIndex]) {
            showPropertyUI(selectedIndex);
        } else {
            alert('Invalid property selected!');
        }
    };

    testingModeContainer.appendChild(testButton);
    document.body.appendChild(testingModeContainer);
}

// Call this function to initialize the testing mode UI
createTestingModeUI();
*/

init();
setupPropertiesToggleButton();