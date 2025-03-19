import Head from 'next/head';
import Chatbot from '../components/Chatbot';

const Home = () => {
  return (
    <>
    <Head>
    <title>CogniSphere - AI Chatbot</title>
    <meta name="description" content="Your AI-powered chatbot assistant." />
  </Head>

    <div>
      <Chatbot />
    </div>
    </>
  );
};

export default Home;
