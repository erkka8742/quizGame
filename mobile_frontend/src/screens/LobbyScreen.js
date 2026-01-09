import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WS_URL } from '../config';

export default function LobbyScreen({ navigation, route }) {
  const { username, gameCode } = route.params;
  const [players, setPlayers] = useState([]);
  const [topics, setTopics] = useState([]);
  const [inputTopic, setInputTopic] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('Connected');
      // Re-register with game
      ws.send(JSON.stringify({
        type: 'username',
        username: username,
        gameCode: gameCode,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'player-joined') {
          setPlayers(data.players);
        }

        if (data.type === 'message') {
          setTopics((prev) => [...prev, {
            username: data.username,
            text: data.text,
          }]);
        }
      } catch (e) {
        console.error('Error parsing message:', e);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('Error');
    };

    ws.onclose = () => {
      setConnectionStatus('Disconnected');
    };

    return () => {
      ws.close();
    };
  }, [username, gameCode]);

  const sendTopic = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && inputTopic.trim()) {
      wsRef.current.send(JSON.stringify({
        type: 'topic',
        username: username,
        text: inputTopic.trim(),
        gameCode: gameCode,
      }));
      setInputTopic('');
    }
  };

  const handleReady = async () => {
    await AsyncStorage.setItem('gameCode', gameCode);
    navigation.navigate('Game', { username, gameCode });
  };

  const isConnected = connectionStatus === 'Connected';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.gameCodeContainer}>
        <Text style={styles.gameCodeLabel}>Game code:</Text>
        <Text style={styles.gameCode}>{gameCode}</Text>
      </View>

      <Text style={styles.status}>
        <Text style={isConnected ? styles.connected : styles.disconnected}>
          {connectionStatus}
        </Text>
      </Text>

      <View style={styles.playersContainer}>
        <Text style={styles.playersTitle}>Players ({players.length})</Text>
        {players.map((player, index) => (
          <View
            key={index}
            style={[styles.playerItem, player === username && styles.currentPlayer]}
          >
            <Text style={[styles.playerName, player === username && styles.currentPlayerText]}>
              {player} {player === username && '(you)'}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.topicsContainer}>
        <Text style={styles.topicsTitle}>Question topics</Text>
        <FlatList
          data={topics}
          keyExtractor={(_, index) => index.toString()}
          style={styles.topicsList}
          renderItem={({ item }) => (
            <View style={[styles.topicItem, item.username === username && styles.ownTopic]}>
              <Text style={styles.topicAuthor}>{item.username}:</Text>
              <Text style={styles.topicText}>{item.text}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No topics yet</Text>
          }
        />
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={inputTopic}
          onChangeText={setInputTopic}
          placeholder="Topics..."
          placeholderTextColor="#666"
          editable={isConnected}
          onSubmitEditing={sendTopic}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={[styles.sendButton, !isConnected && styles.buttonDisabled]}
          onPress={sendTopic}
          disabled={!isConnected}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.readyButton, !isConnected && styles.buttonDisabled]}
        onPress={handleReady}
        disabled={!isConnected}
      >
        <Text style={styles.readyButtonText}>Ready</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    padding: 16,
  },
  gameCodeContainer: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#ff8c42',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  gameCodeLabel: {
    color: '#888',
    fontSize: 14,
  },
  gameCode: {
    color: '#ff8c42',
    fontSize: 36,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  status: {
    textAlign: 'center',
    marginBottom: 12,
  },
  connected: {
    color: '#4caf50',
  },
  disconnected: {
    color: '#f44336',
  },
  playersContainer: {
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  playersTitle: {
    color: '#ff8c42',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  playerItem: {
    backgroundColor: '#000',
    borderRadius: 6,
    padding: 8,
    marginBottom: 4,
  },
  currentPlayer: {
    backgroundColor: 'rgba(255, 140, 66, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 66, 0.3)',
  },
  playerName: {
    color: '#fff',
    fontSize: 16,
  },
  currentPlayerText: {
    color: '#ff8c42',
  },
  topicsContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  topicsTitle: {
    color: '#ff8c42',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  topicsList: {
    flex: 1,
  },
  topicItem: {
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  ownTopic: {
    backgroundColor: 'rgba(255, 140, 66, 0.1)',
    borderColor: 'rgba(255, 140, 66, 0.3)',
  },
  topicAuthor: {
    color: '#ff8c42',
    fontWeight: '600',
    marginBottom: 2,
  },
  topicText: {
    color: '#fff',
    fontSize: 15,
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#fff',
  },
  sendButton: {
    backgroundColor: '#ff8c42',
    paddingHorizontal: 20,
    borderRadius: 10,
    justifyContent: 'center',
  },
  sendButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  readyButton: {
    backgroundColor: '#ff8c42',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#ff8c42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  readyButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
