import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  SafeAreaView,
} from 'react-native';
import { WS_URL } from '../config';

export default function GameScreen({ navigation, route }) {
  const { username, gameCode } = route.params;
  const [ws, setWs] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [options, setOptions] = useState([]);
  const [questionData, setQuestionData] = useState(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [currentTurn, setCurrentTurn] = useState('');
  const [currentTopic, setCurrentTopic] = useState('');
  const [clickedOptions, setClickedOptions] = useState([]);
  const [playerScores, setPlayerScores] = useState({});
  const [hasGivenUp, setHasGivenUp] = useState(false);

  // Popups
  const [myAnswerPopup, setMyAnswerPopup] = useState(null);
  const [votePopup, setVotePopup] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const optionsRef = useRef([]);
  const roundEndProcessed = useRef(false);
  const wsRef = useRef(null);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    if (myAnswerPopup) {
      const timer = setTimeout(() => setMyAnswerPopup(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [myAnswerPopup]);

  useEffect(() => {
    const websocket = new WebSocket(WS_URL);
    wsRef.current = websocket;

    websocket.onopen = () => {
      websocket.send(JSON.stringify({
        type: 'ready-message',
        username: username,
        gameCode: gameCode,
      }));
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'question') {
          const parsed = JSON.parse(data.text);
          setQuestionData(parsed);
          setCurrentQuestion(parsed.question);
          setCurrentTopic(parsed.category || parsed.topic || 'Quiz');
          setOptions(Object.values(parsed.options || {}));
          setClickedOptions([]);
          setHasGivenUp(false);
          setMyAnswerPopup(null);
          setShowLeaderboard(false);
          roundEndProcessed.current = false;
          setCurrentTurn(data.turn);
          setIsMyTurn(data.turn === username);
        }

        if (data.type === 'correct-answer') {
          if (data.username !== username) {
            const idx = optionsRef.current.indexOf(data.question);
            if (idx > -1) {
              setClickedOptions((prev) => [...prev, idx]);
            }
            setVotePopup({
              username: data.username,
              question: data.question,
              answer: data.answer,
            });
          }
        }

        if (data.type === 'voting-result') {
          if (data.username && data.score) {
            setPlayerScores((prev) => ({ ...prev, [data.username]: data.score }));
          }
          setCurrentTurn(data.nextTurn);
          setIsMyTurn(data.nextTurn === username);
        }

        if (data.type === 'end-of-round') {
          if (data.username && data.score) {
            setPlayerScores((prev) => ({ ...prev, [data.username]: data.score }));
          }
          if (!roundEndProcessed.current) {
            roundEndProcessed.current = true;
            setTimeout(() => {
              setShowLeaderboard(true);
              setTimeout(() => {
                if (websocket.readyState === WebSocket.OPEN) {
                  websocket.send(JSON.stringify({
                    type: 'continue-round',
                    gameCode: gameCode,
                  }));
                }
              }, 4000);
            }, 500);
          }
        }

        if (data.type === 'next-turn') {
          setCurrentTurn(data.nextTurn);
          setIsMyTurn(data.nextTurn === username);
          if (data.nextTurn === username) {
            setHasGivenUp(false);
          }
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket closed');
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [username, gameCode]);

  const handleOptionClick = (index) => {
    if (!isMyTurn || clickedOptions.includes(index)) return;

    const optionNumber = (index + 1).toString();
    const answer = questionData?.answers?.[optionNumber];

    setMyAnswerPopup({
      question: options[index],
      answer: answer,
    });

    wsRef.current?.send(JSON.stringify({
      type: 'question-click',
      username: username,
      question: options[index],
      answer: answer,
      gameCode: gameCode,
    }));

    setClickedOptions((prev) => [...prev, index]);
    setIsMyTurn(false);
  };

  const handleVote = (vote) => {
    wsRef.current?.send(JSON.stringify({
      type: 'answer-vote',
      username: votePopup.username,
      vote: vote,
      gameCode: gameCode,
    }));
    setVotePopup(null);
  };

  const handleGiveUp = () => {
    wsRef.current?.send(JSON.stringify({
      type: 'give-up',
      username: username,
      gameCode: gameCode,
    }));
    setHasGivenUp(true);
    setIsMyTurn(false);
  };

  const getLeaderboard = () => {
    return Object.entries(playerScores)
      .map(([player, score]) => ({
        player,
        score: typeof score === 'string' ? parseInt(score.split('+')[0]) : score,
      }))
      .sort((a, b) => b.score - a.score);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {currentTopic ? <Text style={styles.topic}>{currentTopic}</Text> : null}
          {currentTurn ? <Text style={styles.turn}>Turn: {currentTurn}</Text> : null}
        </View>
      </View>

      {/* Question & Options */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {currentQuestion && (
          <>
            <Text style={styles.question}>{currentQuestion}</Text>

            <View style={styles.optionsContainer}>
              {options.map((option, index) => {
                if (clickedOptions.includes(index)) return null;
                return (
                  <TouchableOpacity
                    key={index}
                    style={[styles.optionButton, !isMyTurn && styles.optionDisabled]}
                    onPress={() => handleOptionClick(index)}
                    disabled={!isMyTurn}
                  >
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.giveUpButton, (!isMyTurn || hasGivenUp) && styles.buttonDisabled]}
              onPress={handleGiveUp}
              disabled={!isMyTurn || hasGivenUp}
            >
              <Text style={styles.giveUpText}>Give up</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* My Answer Popup */}
      <Modal visible={!!myAnswerPopup} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.popup}>
            <Text style={styles.popupQuestion}>{myAnswerPopup?.question}</Text>
            <Text style={styles.popupAnswerLabel}>Correct answer:</Text>
            <Text style={styles.popupAnswer}>{myAnswerPopup?.answer}</Text>
          </View>
        </View>
      </Modal>

      {/* Vote Popup */}
      <Modal visible={!!votePopup} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.popup}>
            <Text style={styles.popupQuestion}>{votePopup?.question}</Text>
            <Text style={styles.popupVoteText}>
              Did <Text style={styles.highlight}>{votePopup?.username}</Text>{' '}
              say <Text style={styles.highlight}>{votePopup?.answer}</Text>?
            </Text>
            <View style={styles.voteButtons}>
              <TouchableOpacity style={styles.yesButton} onPress={() => handleVote(1)}>
                <Text style={styles.voteButtonText}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.noButton} onPress={() => handleVote(-1)}>
                <Text style={styles.voteButtonText}>No</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leaderboard Popup */}
      <Modal visible={showLeaderboard} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.popup}>
            <Text style={styles.leaderboardTitle}>Leaderboard</Text>
            {getLeaderboard().map((entry, index) => (
              <View key={entry.player} style={styles.leaderboardItem}>
                <Text style={styles.leaderboardRank}>{index + 1}.</Text>
                <Text style={styles.leaderboardPlayer}>{entry.player}</Text>
                <Text style={styles.leaderboardScore}>{entry.score}</Text>
              </View>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#ff8c42',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  topic: {
    color: '#000',
    fontSize: 18,
    fontWeight: '600',
  },
  turn: {
    color: '#000',
    fontSize: 12,
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  question: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  optionDisabled: {
    opacity: 0.5,
    backgroundColor: '#ccc',
    borderColor: '#999',
  },
  optionText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  giveUpButton: {
    backgroundColor: '#f44336',
    padding: 16,
    borderRadius: 10,
    marginTop: 24,
    alignItems: 'center',
  },
  giveUpText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#ff8c42',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  popupQuestion: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#ff8c42',
  },
  popupAnswerLabel: {
    color: '#aaa',
    fontSize: 16,
  },
  popupAnswer: {
    color: '#ff8c42',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  popupVoteText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 20,
  },
  highlight: {
    color: '#ff8c42',
    fontWeight: 'bold',
  },
  voteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  yesButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  noButton: {
    flex: 1,
    backgroundColor: '#f44336',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  voteButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  leaderboardTitle: {
    color: '#ff8c42',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  leaderboardRank: {
    color: '#ff8c42',
    fontSize: 20,
    fontWeight: 'bold',
    width: 40,
  },
  leaderboardPlayer: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  leaderboardScore: {
    color: '#ff8c42',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
