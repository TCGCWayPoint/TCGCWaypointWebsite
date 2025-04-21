// api/submit-feedback.js
import connectToDatabase from 'TCGCWaypointWebsite\mongodb.js';
import Feedback from 'model\feedback.js"/feedbacks'; // Import your Feedback model

export default async function handler(req, res) {
  if (req.method === 'POST') {
    await connectToDatabase();

    const { name, email, message } = req.body;
    const feedback = new Feedback({ name, email, message });

    try {
      await feedback.save();
      res.status(200).json({ message: 'Feedback submitted successfully!' });
    } catch (err) {
      console.error('Error saving feedback:', err);
      res.status(500).json({ message: 'Error saving feedback' });
    }
  } else {
    res.status(405).end(); // Method Not Allowed for other HTTP methods
  }
}
