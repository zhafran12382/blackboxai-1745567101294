# WhatsApp Clone - Real-time Chat Application

A simple WhatsApp-like chat application built with HTML, JavaScript, and Tailwind CSS. This application uses Ably for real-time messaging and localStorage for data persistence.

## Features

- Real-time group chat
- Image sharing support
- User authentication
- Message history
- Online users count
- Responsive WhatsApp-like design

## Setup Instructions

1. Clone this repository
2. Sign up for an [Ably account](https://ably.com/)
3. Create a new Ably app and get your API key
4. Open `js/chat.js` and replace `YOUR-ABLY-API-KEY` with your actual Ably API key
5. Serve the application using a local server or deploy to Netlify/GitHub Pages

## Deployment

### Local Development

You can use Python's built-in HTTP server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

### Netlify Deployment

1. Fork this repository
2. Sign up for a Netlify account
3. Create a new site from Git
4. Select your forked repository
5. Deploy!

## Security Note

This is a demo application and uses client-side authentication. In a production environment, you should implement proper server-side authentication and secure your Ably API key.

## Technologies Used

- HTML5
- JavaScript (ES6+)
- Tailwind CSS
- Ably Real-time
- Font Awesome Icons
- Google Fonts (Inter)

## Browser Support

The application works best in modern browsers (Chrome, Firefox, Safari, Edge).

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License
