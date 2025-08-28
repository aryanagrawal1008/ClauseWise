// server.js
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fetch = require('node-fetch'); // Corrected: Ensure you have run 'npm install node-fetch@2'
const path = require('path');

const app = express();
const PORT = 3001;

// --- Middleware and Setup ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- Gemini API Helper Function ---
const callGeminiAPI = async (prompt, responseSchema) => {
    const apiKey = "AIzaSyB0DzkBdgF0nyuEvwlKa1aTgypOAMEdB2c"; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: responseSchema },
    };
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorBody = await response.json();
            console.error("Gemini API Error Response:", JSON.stringify(errorBody, null, 2));
            throw new Error(`API call failed: ${errorBody.error.message}`);
        }
        const result = await response.json();
        if (!result.candidates || !result.candidates[0].content.parts[0]) {
             throw new Error("Invalid response structure from API.");
        }
        return JSON.parse(result.candidates[0].content.parts[0].text);
    } catch (error) {
        console.error('Error calling Gemini API:', error);
        throw error;
    }
};

// --- Routes ---
app.get('/', (req, res) => {
    res.render('index', { error: null });
});

app.post('/analyze', upload.single('contract'), async (req, res) => {
    if (!req.file) {
        return res.render('index', { error: 'No file uploaded.' });
    }
    try {
        let contractText = '';
        if (req.file.mimetype === 'application/pdf') {
            contractText = (await pdfParse(req.file.buffer)).text;
        } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            contractText = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
        } else {
            return res.render('index', { error: 'Unsupported file type. Please upload a PDF or DOCX.' });
        }
        const simplifySchema = { type: "OBJECT", properties: { clauses: { type: "ARRAY", items: { type: "OBJECT", properties: { original: { type: "STRING" }, simplified: { type: "STRING" }, explanation: { type: "STRING" } }, required: ["original", "simplified", "explanation"] } } }, required: ["clauses"]};
        const risksSchema = { type: "OBJECT", properties: { risks: { type: "ARRAY", items: { type: "OBJECT", properties: { clause: { type: "STRING" }, risk_type: { type: "STRING" }, reason: { type: "STRING" }, severity: { type: "STRING" } }, required: ["clause", "risk_type", "reason", "severity"] } } }, required: ["risks"]};
        const fairnessSchema = { type: "OBJECT", properties: { fairness_score: { type: "NUMBER" }, favored_party: { type: "STRING" }, reason: { type: "STRING" } }, required: ["fairness_score", "favored_party", "reason"]};
        const [simplifiedClauses, risks, fairness] = await Promise.all([
            callGeminiAPI(`Simplify the following contract: ${contractText}`, simplifySchema),
            callGeminiAPI(`Analyze risks for the following contract: ${contractText}`, risksSchema),
            callGeminiAPI(`Analyze fairness for the following contract: ${contractText}`, fairnessSchema)
        ]);
        res.render('dashboard', {
            fileName: req.file.originalname,
            simplifiedClauses: simplifiedClauses.clauses || [],
            risks: risks.risks || [],
            fairness: fairness || { fairness_score: 0, favored_party: 'N/A', reason: 'Could not be determined.' },
            contractText: contractText
        });
    } catch (error) {
        res.render('index', { error: `Failed to analyze the document. Reason: ${error.message}` });
    }
});

// **UPDATED AI LAWYER ROUTE**
app.post('/ask-lawyer', async (req, res) => {
    const { contractText, userQuestion } = req.body;
    const prompt = `
        You are an AI Lawyer providing clear, concise, and actionable advice.
        Analyze the document and the user's question. Provide your answer in the following JSON structure ONLY:
        {
          "advice": "A short, direct answer to the user's question (1-2 sentences). Start with 'Yes' or 'No' if possible.",
          "reasoning": "A brief explanation for your advice based on the document's content (2-3 sentences)."
        }
        Do not state you are an AI. If the document is a standard form, explain its purpose simply in your reasoning.

        Contract Text: "${contractText}"
        User's Question: "${userQuestion}"
    `;
    const schema = { 
        type: "OBJECT", 
        properties: { 
            advice: { type: "STRING" },
            reasoning: { type: "STRING" } 
        }, 
        required: ["advice", "reasoning"] 
    };
    try {
        const result = await callGeminiAPI(prompt, schema);
        res.json(result);
    } catch (error) {
        res.status(500).json({ advice: 'Sorry, I encountered an error.', reasoning: 'Please try your question again.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
