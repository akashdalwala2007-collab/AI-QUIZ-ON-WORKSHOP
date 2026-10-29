import { Question } from '../types';

export interface VoiceoverConfig {
  id: number;
  file: string;
  startTime: number;
  endTime: number;
}

export const VOICEOVER_CONFIG: VoiceoverConfig[] = [
  { id: 1, file: '/voiceover/vc1.mp4', startTime: 0, endTime: 70 },
  { id: 2, file: '/voiceover/vc2.mp4', startTime: 70, endTime: 150 },
  { id: 3, file: '/voiceover/vc3.mp4', startTime: 150, endTime: 235 },
  { id: 4, file: '/voiceover/vc4.mp4', startTime: 235, endTime: 320 },
  { id: 5, file: '/voiceover/vc5.mp4', startTime: 320, endTime: 400 },
  { id: 6, file: '/voiceover/vc6.mp4', startTime: 400, endTime: 480 },
  { id: 7, file: '/voiceover/vc7.mp4', startTime: 480, endTime: 560 },
  { id: 8, file: '/voiceover/vc8.mp4', startTime: 560, endTime: 640 },
  { id: 9, file: '/voiceover/vc9.mp4', startTime: 640, endTime: 720 },
  { id: 10, file: '/voiceover/vc10.mp4', startTime: 720, endTime: 800 },
];

export interface AppConfig {
  videoTitle: string;
  videoSrc: string;
  introVideoSrc: string;
  videoDuration: number; // in seconds (~854.6s)
  voiceovers: VoiceoverConfig[];
  questions: Question[];
}

export const QUIZ_CONFIG: AppConfig = {
  videoTitle: 'Building an AI Chatbot with Google Gemini & Streamlit in Python',
  videoSrc: '/video.mp4',
  introVideoSrc: '/intro.mp4',
  videoDuration: 854.6,
  voiceovers: VOICEOVER_CONFIG,
  questions: [
    {
      id: 1,
      type: 'mcq',
      timestamp: 70, // 01:10 - Early in the video when setting up Python environment & app.py
      question: 'Which programming language is used to build the AI chatbot?',
      options: [
        { label: 'A', text: 'Java' },
        { label: 'B', text: 'Python' },
        { label: 'C', text: 'C++' },
        { label: 'D', text: 'HTML' },
      ],
      correctAnswer: 'B',
      explanation: 'Python is used with the Google GenAI SDK and Streamlit to build the chatbot application.',
      category: 'Core Language',
    },
    {
      id: 2,
      type: 'mcq',
      timestamp: 150, // 02:30 - Setting up Google GenAI client and GEMINI_API_KEY
      question: 'Which Google AI service is used in the video?',
      options: [
        { label: 'A', text: 'Gemini' },
        { label: 'B', text: 'Alexa' },
        { label: 'C', text: 'Siri' },
        { label: 'D', text: 'Watson' },
      ],
      correctAnswer: 'A',
      explanation: "Google's Gemini model (gemini-2.5-flash) provides the generative AI capabilities via the google-genai library.",
      category: 'AI Model',
    },
    {
      id: 3,
      type: 'mcq',
      timestamp: 235, // 03:55 - Writing the UI layout with Streamlit functions
      question: 'Which framework is used to create the chatbot interface?',
      options: [
        { label: 'A', text: 'React' },
        { label: 'B', text: 'Flask' },
        { label: 'C', text: 'Streamlit' },
        { label: 'D', text: 'Angular' },
      ],
      correctAnswer: 'C',
      explanation: 'Streamlit is used to build the interactive web frontend directly in Python with simple declarative widgets.',
      category: 'Web Framework',
    },
    {
      id: 4,
      type: 'mcq',
      timestamp: 320, // 05:20 - Discussing client API connections and requesting completions
      question: 'What is the purpose of an API?',
      options: [
        { label: 'A', text: 'To design images' },
        { label: 'B', text: 'To connect and communicate with services' },
        { label: 'C', text: 'To delete files' },
        { label: 'D', text: 'To format a computer' },
      ],
      correctAnswer: 'B',
      explanation: 'An API (Application Programming Interface) allows programs and applications to communicate with external services like Gemini.',
      category: 'API Concepts',
    },
    {
      id: 5,
      type: 'true_false',
      timestamp: 400, // 06:40 - Reviewing app.py code and project files
      question: 'A Python file commonly has the .py extension.',
      options: [
        { label: 'A', text: 'True' },
        { label: 'B', text: 'False' },
      ],
      correctAnswer: 'A',
      explanation: 'Python source code files are saved with the .py extension, as seen with app.py in the VS Code editor.',
      category: 'Python Basics',
    },
    {
      id: 6,
      type: 'true_false',
      timestamp: 480, // 08:00 - Structuring UI widgets and prompt text areas
      question: 'Streamlit can be used to create a user interface for an AI chatbot.',
      options: [
        { label: 'A', text: 'True' },
        { label: 'B', text: 'False' },
      ],
      correctAnswer: 'A',
      explanation: 'Streamlit makes it effortless to create browser-based user interfaces with text inputs, buttons, and markdown output.',
      category: 'Streamlit UI',
    },
    {
      id: 7,
      type: 'true_false',
      timestamp: 560, // 09:20 - Configuring temperature and max_output_tokens
      question: 'The temperature parameter can affect the randomness of AI-generated responses.',
      options: [
        { label: 'A', text: 'True' },
        { label: 'B', text: 'False' },
      ],
      correctAnswer: 'A',
      explanation: 'Lower temperature values (e.g. 0.2) produce more deterministic, focused outputs, while higher values increase randomness and creativity.',
      category: 'Model Parameters',
    },
    {
      id: 8,
      type: 'one_word',
      timestamp: 640, // 10:40 - Explaining client initialization and API fundamentals
      question: 'What is the full form of API?',
      correctAnswer: 'Application Programming Interface',
      explanation: 'API stands for Application Programming Interface, enabling programmatic interaction between software systems.',
      category: 'Definitions',
    },
    {
      id: 9,
      type: 'one_word',
      timestamp: 720, // 12:00 - Capturing user input text area and sending to Gemini
      question: 'What do we call the instructions given to an AI model?',
      correctAnswer: 'Prompt',
      explanation: 'A prompt is the natural language input instruction provided to a large language model to elicit a response.',
      category: 'Generative AI',
    },
    {
      id: 10,
      type: 'one_word',
      timestamp: 800, // 13:20 - Running pip install and executing streamlit run app.py
      question: 'Which command-line tool is commonly used to install Python packages?',
      correctAnswer: 'pip',
      explanation: 'pip is the standard package manager for Python used to install dependencies listed in requirements.txt.',
      category: 'Tooling',
    },
  ],
};
