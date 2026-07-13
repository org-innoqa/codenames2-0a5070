import React, { useState, useEffect, useRef } from 'react';
import { db } from './lib/db';
import { getRandomWords } from './words';
import {
  Users,
  Shield,
  User,
  Play,
  RefreshCw,
  Send,
  LogOut,
  Award,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Volume2,
  VolumeX
} from 'lucide-react';

interface Player {
  id: string;
  room_code: string;
  nickname: string;
  team: 'red' | 'blue';
  role: 'spymaster' | 'operative';
}

interface Card {
  id: string;
  room_code: string;
  word: string;
  color: 'red' | 'blue' | 'neutral' | 'assassin';
  revealed: boolean;
  card_index: number;
}

interface Room {
  code: string;
  status: 'lobby' | 'playing' | 'ended';
  turn: 'red' | 'blue';
  winner: string | null;
  clue_word: string | null;
  clue_count: number | null;
  guesses_left: number | null;
}

interface GameLog {
  id: string;
  room_code: string;
  message: string;
  created_at: string;
}

export default function App() { 
  // User state
  const [nickname, setNickname] = useState<string>(() => localStorage.getItem('cn_nickname') || '');
  const [roomCode, setRoomCode] = useState<string>('');
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);

  // Game state
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [logs, setLogs] = useState<GameLog[]>([]);

  // UI states
  const [clueWordInput, setClueWordInput] = useState('');
  const [clueCountInput, setClueCountInput] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showRules, setShowRules] = useState(false);

  // Polling interval ref
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // Save nickname to local storage
  useEffect(() => {
    if (nickname.trim()) {
      localStorage.setItem('cn_nickname', nickname.trim());
    }
  }, [nickname]);

  // Polling logic to keep game in sync
  useEffect(() => {
    if (roomCode) {
      fetchGameState();
      pollingInterval.current = setInterval(fetchGameState, 2000);
    } else {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    }
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [roomCode]);

  const playSound = (type: 'click' | 'reveal' | 'win' | 'lose' | 'turn') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      if (type === 'click') {
        oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
      } else if (type === 'reveal') {
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
      } else if (type === 'win') {
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        oscillator.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
        oscillator.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
      } else if (type === 'lose') {
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'turn') {
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      }
    } catch (e) {
      console.error("Audio error", e);
    }
  };

  const fetchGameState = async () => {
    if (!roomCode) return;
    try {
      // Fetch Room
      const roomsData = await db.select('rooms', `?code=eq.${roomCode}`);
      if (roomsData && roomsData.length > 0) {
        const updatedRoom = roomsData[0] as Room;
        
        // Play sound if turn changed
        if (room && room.turn !== updatedRoom.turn && updatedRoom.status === 'playing') {
          playSound('turn');
        }
        // Play sound if winner declared
        if (room && !room.winner && updatedRoom.winner) {
          if (currentPlayer && currentPlayer.team === updatedRoom.winner) {
            playSound('win');
          } else {
            playSound('lose');
          }
        }

        setRoom(updatedRoom);
      } else {
        // Room might have been deleted or code is wrong
        setError("Oda bulunamadı.");
        leaveRoom();
        return;
      }

      // Fetch Players
      const playersData = await db.select('players', `?room_code=eq.${roomCode}`);
      setPlayers(playersData as Player[]);

      // Sync current player state
      if (currentPlayer) {
        const me = (playersData as Player[]).find(p => p.id === currentPlayer.id);
        if (me) {
          setCurrentPlayer(me);
        }
      }

      // Fetch Cards
      const cardsData = await db.select('cards', `?room_code=eq.${roomCode}&order=card_index.asc`);
      setCards(cardsData as Card[]);

      // Fetch Logs
      const logsData = await db.select('game_logs', `?room_code=eq.${roomCode}&order=created_at.desc&limit=15`);
      setLogs(logsData as GameLog[]);
    } catch (err) { 
      console.error("Error fetching game state:", err);
    }
  };

  const createRoom = async () => {
    if (!nickname.trim()) {
      setError("Lütfen önce bir rumuz girin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const code = Math.random().toString(36).substring(2, 6).toUpperCase();
      
      // Create room record
      await db.insert('rooms', {
        code,
        status: 'lobby',
        turn: 'red',
        winner: null,
        clue_word: null,
        clue_count: null,
        guesses_left: null
      });

      // Add creator as player (Red Team, Operative by default)
      const [newPlayer] = await db.insert('players', {
        room_code: code,
        nickname: nickname.trim(),
        team: 'red',
        role: 'operative'
      });

      // Add initial log
      await db.insert('game_logs', {
        room_code: code,
        message: `${nickname.trim()} odayı kurdu.`
      });

      setRoomCode(code);
      setCurrentPlayer(newPlayer as Player);
      playSound('click');
    } catch (err) {
      console.error(err);
      setError("Oda oluşturulurken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!nickname.trim()) {
      setError("Lütfen önce bir rumuz girin.");
      return;
    }
    if (!roomCode.trim()) {
      setError("Lütfen geçerli bir oda kodu girin.");
      return;
    }
    setLoading(true);
    setError(null);
    const targetCode = roomCode.trim().toUpperCase();
    try {
      const roomsData = await db.select('rooms', `?code=eq.${targetCode}`);
      if (!roomsData || roomsData.length === 0) {
        setError("Oda bulunamadı. Lütfen kodu kontrol edin.");
        setLoading(false);
        return;
      }

      // Check if nickname already exists in room
      const existingPlayers = await db.select('players', `?room_code=eq.${targetCode}`);
      const nameExists = (existingPlayers as Player[]).some(
        p => p.nickname.toLowerCase() === nickname.trim().toLowerCase()
      );
      
      const finalNickname = nameExists 
        ? `${nickname.trim()} (${Math.floor(Math.random() * 90) + 10})` 
        : nickname.trim();

      // Determine team balance
      const redCount = (existingPlayers as Player[]).filter(p => p.team === 'red').length;
      const blueCount = (existingPlayers as Player[]).filter(p => p.team === 'blue').length;
      const assignedTeam = redCount <= blueCount ? 'red' : 'blue';

      // Add player
      const [newPlayer] = await db.insert('players', {
        room_code: targetCode,
        nickname: finalNickname,
        team: assignedTeam,
        role: 'operative'
      });

      // Add log
      await db.insert('game_logs', {
        room_code: targetCode,
        message: `${finalNickname} oyuna katıldı.`
      });

      setRoomCode(targetCode);
      setCurrentPlayer(newPlayer as Player);
      playSound('click');
    } catch (err) {
      console.error(err);
      setError("Odaya katılırken bir hata oluştu.");
    } finally {
      setLoading(false);
    }
  };

  const leaveRoom = async () => {
    if (currentPlayer) {
      try {
        await db.remove('players', `?id=eq.${currentPlayer.id}`);
        await db.insert('game_logs', {
          room_code: roomCode,
          message: `${currentPlayer.nickname} odadan ayrıldı.`
        });
      } catch (e) {
        console.error(e);
      }
    }
    setRoomCode('');
    setRoom(null);
    setCurrentPlayer(null);
    setCards([]);
    setLogs([]);
    playSound('click');
  };

  const switchTeam = async (team: 'red' | 'blue') => {
    if (!currentPlayer || !roomCode) return;
    try {
      await db.update('players', `?id=eq.${currentPlayer.id}`, { team });
      await db.insert('game_logs', {
        room_code: roomCode,
        message: `${currentPlayer.nickname} takım değiştirdi: ${team === 'red' ? 'Kırmızı' : 'Mavi'}`
      });
      playSound('click');
      fetchGameState();
    } catch (err) {
      console.error(err);
    }
  };

  const switchRole = async (role: 'spymaster' | 'operative') => {
    if (!currentPlayer || !roomCode) return;
    try {
      // Check if there's already a spymaster for this team
      if (role === 'spymaster') {
        const teamSpymasters = players.filter(p => p.team === currentPlayer.team && p.role === 'spymaster');
        if (teamSpymasters.length > 0) {
          setError(`Bu takımın zaten bir Casus Yöneticisi var: ${teamSpymasters[0].nickname}`);
          setTimeout(() => setError(null), 4000);
          return;
        }
      }

      await db.update('players', `?id=eq.${currentPlayer.id}`, { role });
      await db.insert('game_logs', {
        room_code: roomCode,
        message: `${currentPlayer.nickname} rol değiştirdi: ${role === 'spymaster' ? 'Casus Yöneticisi' : 'Saha Elemanı'}`
      });
      playSound('click');
      fetchGameState();
    } catch (err) {
      console.error(err);
    }
  };

  const startGame = async () => {
    if (!roomCode) return;
    setLoading(true);
    try {
      // Generate 25 words
      const words = getRandomWords(25);
      
      // Generate colors: Red starts, gets 9. Blue gets 8. Neutral gets 7. Assassin gets 1.
      // Total = 25
      const colors: ('red' | 'blue' | 'neutral' | 'assassin')[] = [
        'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red',
        'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue',
        'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral', 'neutral',
        'assassin'
      ];

      // Shuffle colors
      const shuffledColors = colors.sort(() => 0.5 - Math.random());

      // Delete old cards if any
      await db.remove('cards', `?room_code=eq.${roomCode}`);

      // Insert new cards
      for (let i = 0; i < 25; i++) {
        await db.insert('cards', {
          room_code: roomCode,
          word: words[i],
          color: shuffledColors[i],
          revealed: false,
          card_index: i
        });
      }

      // Update room status
      await db.update('rooms', `?code=eq.${roomCode}`, {
        status: 'playing',
        turn: 'red',
        winner: null,
        clue_word: null,
        clue_count: null,
        guesses_left: null
      });

      // Add log
      await db.insert('game_logs', {
        room_code: roomCode,
        message: "Yeni oyun başladı! Kırmızı takımın sırası."
      });

      playSound('win');
      fetchGameState();
    } catch (err) {
      console.error(err);
      setError("Oyun başlatılamadı.");
    } finally {
      setLoading(false);
    }
  };

  const submitClue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room || !currentPlayer || !roomCode) return;
    if (!clueWordInput.trim() || clueCountInput < 0) return;

    try {
      await db.update('rooms', `?code=eq.${roomCode}`, {
        clue_word: clueWordInput.trim(),
        clue_count: clueCountInput,
        guesses_left: clueCountInput + 1 // Codenames rules allow clue count + 1 guesses
      });

      await db.insert('game_logs', {
        room_code: roomCode,
        message: `🕵️‍♂️ İpucu Verildi: "${clueWordInput.trim()} ${clueCountInput}"`
      });

      setClueWordInput('');
      playSound('click');
      fetchGameState();
    } catch (err) {
      console.error(err);
    }
  };

  const revealCard = async (card: Card) => {
    if (!room || !currentPlayer || !roomCode) return;
    // Only operatives can click cards on their turn
    if (currentPlayer.role !== 'operative') return;
    if (room.turn !== currentPlayer.team) return;
    if (card.revealed) return;
    if (room.status !== 'playing') return;
    // Must have a clue submitted to guess
    if (!room.clue_word) {
      setError("Önce Casus Yöneticisinin bir ipucu vermesi gerekiyor!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    playSound('reveal');
    try {
      // Reveal card
      await db.update('cards', `?id=eq.${card.id}`, { revealed: true });

      let nextTurn = room.turn;
      let nextGuesses = (room.guesses_left || 1) - 1;
      let winner: string | null = null;
      let logMessage = `${currentPlayer.nickname} "${card.word}" kartını açtı.`;

      // Check card color consequences
      if (card.color === 'assassin') {
        // Assassin card! Opponent wins immediately
        winner = room.turn === 'red' ? 'blue' : 'red';
        logMessage += ` 💀 SUİKASTÇİ! Oyun bitti. Kazanan: ${winner === 'red' ? 'Kırmızı' : 'Mavi'} Takım!`;
      } else if (card.color === room.turn) {
        // Correct guess
        logMessage += ` ✅ Doğru tahmin!`;
        
        // Check if all cards of this color are revealed
        const sameColorCards = cards.filter(c => c.color === room.turn);
        const revealedSameColor = sameColorCards.filter(c => c.revealed || c.id === card.id).length;
        
        if (revealedSameColor === sameColorCards.length) {
          winner = room.turn;
          logMessage += ` 🎉 Tüm kelimeler bulundu! Kazanan: ${winner === 'red' ? 'Kırmızı' : 'Mavi'} Takım!`;
        } else if (nextGuesses <= 0) {
          // Out of guesses, turn ends
          nextTurn = room.turn === 'red' ? 'blue' : 'red';
          logMessage += ` Sıra karşı takıma geçti.`;
        }
      } else {
        // Wrong guess (neutral or opponent)
        nextTurn = room.turn === 'red' ? 'blue' : 'red';
        
        if (card.color === 'neutral') {
          logMessage += ` ⚪ Nötr kart. Sıra karşı takıma geçti.`;
        } else {
          logMessage += ` ❌ Rakip takımın kartı! Sıra karşı takıma geçti.`;
          
          // Check if opponent just won because of this reveal
          const opponentColor = room.turn === 'red' ? 'blue' : 'red';
          const opponentCards = cards.filter(c => c.color === opponentColor);
          const revealedOpponent = opponentCards.filter(c => c.revealed || c.id === card.id).length;
          
          if (revealedOpponent === opponentCards.length) {
            winner = opponentColor;
            logMessage += ` 🎉 Rakibin tüm kelimeleri tamamlandı! Kazanan: ${winner === 'red' ? 'Kırmızı' : 'Mavi'} Takım!`;
          }
        }
      }

      // Update room state
      await db.update('rooms', `?code=eq.${roomCode}`, {
        turn: nextTurn,
        winner: winner,
        status: winner ? 'ended' : 'playing',
        guesses_left: winner ? null : (nextTurn !== room.turn ? null : nextGuesses),
        clue_word: winner ? null : (nextTurn !== room.turn ? null : room.clue_word),
        clue_count: winner ? null : (nextTurn !== room.turn ? null : room.clue_count)
      });

      // Add log
      await db.insert('game_logs', {
        room_code: roomCode,
        message: logMessage
      });

      fetchGameState();
    } catch (err) {
      console.error(err);
    }
  };

  const endTurn = async () => {
    if (!room || !currentPlayer || !roomCode) return;
    if (room.turn !== currentPlayer.team || currentPlayer.role !== 'operative') return;

    try {
      const nextTurn = room.turn === 'red' ? 'blue' : 'red';
      await db.update('rooms', `?code=eq.${roomCode}`, {
        turn: nextTurn,
        clue_word: null,
        clue_count: null,
        guesses_left: null
      });

      await db.insert('game_logs', {
        room_code: roomCode,
        message: `${currentPlayer.nickname} sırasını pas geçti. Sıra ${nextTurn === 'red' ? 'Kırmızı' : 'Mavi'} takımda.`
      });

      playSound('click');
      fetchGameState();
    } catch (err) {
      console.error(err);
    }
  };

  // Helper stats
  const redRemaining = cards.filter(c => c.color === 'red' && !c.revealed).length;
  const blueRemaining = cards.filter(c => c.color === 'blue' && !c.revealed).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-spyred to-spyblue p-2 rounded-xl shadow-inner">
              <span className="text-2xl font-bold tracking-wider">🕵️‍♂️</span>
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider bg-gradient-to-r from-red-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">
                CODENAMES
              </h1>
              <p className="text-xs text-slate-400 font-medium">Çevrimiçi Gizli Ajan Oyunu</p>
            </div>
          </div>

          {roomCode && (
            <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800">
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Oda Kodu:</span>
              <span className="text-lg font-mono font-bold text-yellow-400 tracking-widest">{roomCode}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title={soundEnabled ? "Sesi Kapat" : "Sesi Aç"}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={() => setShowRules(!showRules)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center gap-1 text-sm font-medium"
            >
              <HelpCircle size={18} />
              <span className="hidden sm:inline">Nasıl Oynanır?</span>
            </button>
            {roomCode && (
              <button
                onClick={leaveRoom}
                className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/50 transition-colors flex items-center gap-1 text-sm font-medium"
              >
                <LogOut size={18} />
                <span className="hidden sm:inline">Odadan Çık</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Rules Modal */}
      {showRules && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-2xl font-bold text-yellow-400 flex items-center gap-2">
                🕵️‍♂️ Codenames Nasıl Oynanır?
              </h3>
              <button
                onClick={() => setShowRules(false)}
                className="text-slate-400 hover:text-white text-xl font-bold bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
              <p>
                Codenames, iki takımın (<strong>Kırmızı</strong> ve <strong>Mavi</strong>) gizli ajanlarını bulmak için yarıştığı eğlenceli bir kelime oyunudur.
              </p>
              <div className="border-l-4 border-yellow-500 pl-3 py-1 bg-yellow-500/10 rounded-r">
                <p className="font-semibold text-yellow-400">Temel Roller:</p>
                <ul className="list-disc list-inside space-y-1 mt-1">
                  <li><strong>Casus Yöneticisi (Spymaster):</strong> Kartların arkasındaki renkleri görür. Takımına tek kelimelik bir ipucu ve bu ipucuyla ilişkili kart sayısını verir.</li>
                  <li><strong>Saha Elemanı (Operative):</strong> Kartların renklerini göremez. Casus yöneticisinin verdiği ipucuna dayanarak doğru kelimeleri tahmin etmeye çalışır.</li>
                </ul>
              </div>
              <div>
                <p className="font-semibold text-white mb-1">Oyun Akışı:</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Sırası gelen takımın Casus Yöneticisi bir ipucu kelimesi ve bir sayı girer (Örn: "Mutfak 3").</li>
                  <li>Saha Elemanları bu ipucuyla ilişkili olduğunu düşündükleri kartlara tıklar.</li>
                  <li>Eğer kendi takımının rengini bulursa, tahmin hakkı devam eder (en fazla ipucu sayısı + 1 kez).</li>
                  <li>Eğer nötr (gri) karta basarsa sıra biter.</li>
                  <li>Eğer rakip takımın kartına basarsa sıra biter ve rakibe puan yazılır.</li>
                  <li>Eğer <strong>Siyah (Suikastçi)</strong> karta basarsa, takım anında oyunu kaybeder!</li>
                </ol>
              </div>
              <p className="text-xs text-slate-400 border-t border-slate-800 pt-3">
                Tüm ajanlarını (Kırmızı: 9, Mavi: 8) rakibinden önce bulan veya rakibin suikastçiyi açmasını sağlayan takım oyunu kazanır.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 flex flex-col justify-center">
        {error && (
          <div className="mb-4 bg-red-900/80 border border-red-700 text-red-100 px-4 py-3 rounded-xl flex items-center justify-between shadow-lg animate-pulse">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <p className="font-medium">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-300 hover:text-white font-bold">
              ×
            </button>
          </div>
        )}

        {!roomCode ? (
          /* LOBBY / JOIN SCREEN */
          <div className="max-w-md mx-auto w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Decorative background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-spyred/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-spyblue/20 rounded-full blur-3xl"></div>

            <div className="relative z-10">
              <div className="text-center mb-8">
                <span className="text-5xl mb-2 block">🕵️‍♂️🕵️‍♀️</span>
                <h2 className="text-2xl font-black tracking-tight text-white">Ajanlar Toplanıyor!</h2>
                <p className="text-slate-400 text-sm mt-1">Hemen bir oda kurun veya arkadaşlarınızın odasına katılın.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Rumuzunuz (Nickname) <span className="text-red-500">* Zorunlu</span>
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                      <User size={18} />
                    </span>
                    <input
                      type="text"
                      maxLength={15}
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Örn: Ajan_007"
                      className={`w-full bg-slate-950 border rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-1 transition-all font-medium ${
                        !nickname.trim() 
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500' 
                          : 'border-slate-800 focus:border-purple-500 focus:ring-purple-500'
                      }`}
                    />
                  </div>
                  {!nickname.trim() && (
                    <p className="text-red-400 text-xs mt-1.5 font-semibold flex items-center gap-1 animate-pulse">
                      ⚠️ Devam etmek için bir rumuz (nickname) yazmalısınız!
                    </p>
                  )}
                </div>

                <div className="border-t border-slate-800/80 my-6"></div>

                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={createRoom}
                    disabled={loading || !nickname.trim()}
                    className="w-full bg-gradient-to-r from-spyred to-spyred-dark hover:from-red-500 hover:to-red-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-red-900/20 hover:shadow-red-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Play size={20} />
                    Yeni Oda Kur
                  </button>

                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-4 text-slate-500 text-xs font-bold uppercase tracking-wider">veya</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                      Oda Kodu ile Katıl
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={roomCode}
                        onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                        placeholder="KOD"
                        className="bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-center text-white placeholder-slate-700 focus:outline-none focus:border-spyblue focus:ring-1 focus:ring-spyblue transition-all font-mono font-bold tracking-widest text-lg w-32 uppercase"
                      />
                      <button
                        onClick={joinRoom}
                        disabled={loading || !nickname.trim()}
                        className="flex-1 bg-gradient-to-r from-spyblue to-spyblue-dark hover:from-blue-500 hover:to-blue-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Users size={18} />
                        Odaya Gir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* GAME SCREEN */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Left Sidebar: Teams & Players */}
            <div className="lg:col-span-1 space-y-4">
              {/* Room Info & Status */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Users size={16} />
                  Oyuncular ({players.length})
                </h3>
                
                {/* Red Team Box */}
                <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 mb-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-red-400 font-bold text-sm flex items-center gap-1.5">
                      🔴 Kırmızı Takım
                    </span>
                    <span className="bg-red-900/40 text-red-300 text-xs px-2 py-0.5 rounded-full font-bold">
                      {redRemaining} Ajan Kaldı
                    </span>
                  </div>
                  
                  <div className="space-y-1.5">
                    {players.filter(p => p.team === 'red').map(p => ( 
                      <div key={p.id} className="flex items-center justify-between bg-slate-950/50 px-2.5 py-1.5 rounded-lg text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-1">
                          {p.role === 'spymaster' ? '🕵️‍♂️' : '🏃‍♂️'}
                          {p.nickname} {p.id === currentPlayer?.id && "(Siz)"}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-red-400/80 bg-red-950/50 px-1.5 py-0.5 rounded">
                          {p.role === 'spymaster' ? 'Casus' : 'Saha'}
                        </span>
                      </div>
                    ))}
                    {players.filter(p => p.team === 'red').length === 0 && (
                      <p className="text-xs text-slate-500 italic text-center py-1">Oyuncu yok</p>
                    )}
                  </div>

                  {currentPlayer?.team !== 'red' && (
                    <button
                      onClick={() => switchTeam('red')}
                      className="w-full mt-2 text-xs bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-900/40 py-1 rounded-lg transition-colors font-medium"
                    >
                      Kırmızı Takıma Geç
                    </button>
                  )}
                </div>

                {/* Blue Team Box */}
                <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-blue-400 font-bold text-sm flex items-center gap-1.5">
                      🔵 Mavi Takım
                    </span>
                    <span className="bg-blue-900/40 text-blue-300 text-xs px-2 py-0.5 rounded-full font-bold">
                      {blueRemaining} Ajan Kaldı
                    </span>
                  </div>
                  
                  <div className="space-y-1.5">
                    {players.filter(p => p.team === 'blue').map(p => ( 
                      <div key={p.id} className="flex items-center justify-between bg-slate-950/50 px-2.5 py-1.5 rounded-lg text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-1">
                          {p.role === 'spymaster' ? '🕵️‍♂️' : '🏃‍♂️'}
                          {p.nickname} {p.id === currentPlayer?.id && "(Siz)"}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-blue-400/80 bg-blue-950/50 px-1.5 py-0.5 rounded">
                          {p.role === 'spymaster' ? 'Casus' : 'Saha'}
                        </span>
                      </div>
                    ))}
                    {players.filter(p => p.team === 'blue').length === 0 && (
                      <p className="text-xs text-slate-500 italic text-center py-1">Oyuncu yok</p>
                    )}
                  </div>

                  {currentPlayer?.team !== 'blue' && (
                    <button
                      onClick={() => switchTeam('blue')}
                      className="w-full mt-2 text-xs bg-blue-950/40 hover:bg-blue-900/50 text-blue-300 border border-blue-900/40 py-1 rounded-lg transition-colors font-medium"
                    >
                      Mavi Takıma Geç
                    </button>
                  )}
                </div>
              </div>

              {/* Role Selection */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Shield size={16} />
                  Rol Seçimi
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => switchRole('operative')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      currentPlayer?.role === 'operative'
                        ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>🏃‍♂️</span>
                    <span>Saha Elemanı</span>
                  </button>
                  <button
                    onClick={() => switchRole('spymaster')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex flex-col items-center gap-1 ${
                      currentPlayer?.role === 'spymaster'
                        ? 'bg-yellow-600 border-yellow-500 text-white shadow-lg shadow-yellow-900/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span>🕵️‍♂️</span>
                    <span>Casus Yöneticisi</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 text-center">
                  * Her takımda sadece 1 adet Casus Yöneticisi olabilir.
                </p>
              </div>

              {/* Game Controls (Start / Reset) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                {room?.status === 'lobby' ? (
                  <button
                    onClick={startGame}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Play size={18} />
                    Oyunu Başlat
                  </button>
                ) : (
                  <button
                    onClick={startGame}
                    disabled={loading}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-sm"
                  >
                    <RefreshCw size={16} />
                    Yeni Oyun Kur / Yenile
                  </button>
                )}
              </div>
            </div>

            {/* Center: Game Board */}
            <div className="lg:col-span-3 space-y-4">
              {/* Status Banner */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full animate-ping ${ 
                    room?.turn === 'red' ? 'bg-red-500' : 'bg-blue-500'
                  }`}></div>
                  <div>
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Sıradaki Takım</span>
                    <h4 className={`text-lg font-black uppercase ${
                      room?.turn === 'red' ? 'text-red-500' : 'text-blue-500'
                    }`}>
                      {room?.turn === 'red' ? '🔴 Kırmızı Takım' : '🔵 Mavi Takım'}
                    </h4>
                  </div>
                </div>

                {/* Clue Display */}
                <div className="bg-slate-950/80 border border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-3 min-w-[200px] justify-center">
                  {room?.clue_word ? (
                    <div className="text-center">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Verilen İpucu</span>
                      <span className="text-base font-bold text-yellow-400 uppercase tracking-wide">
                        {room.clue_word} <span className="bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-md text-sm ml-1">{room.clue_count}</span>
                      </span>
                      {room.guesses_left !== null && (
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Kalan Tahmin Hakkı: <strong className="text-white">{room.guesses_left}</strong>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-1">
                      <span className="text-xs text-slate-400 italic">
                        {room?.status === 'playing' ? "Casus yöneticisinden ipucu bekleniyor..." : "Oyun henüz başlamadı"}
                      </span>
                    </div>
                  )}
                </div>

                {/* End Turn Button for Operatives */}
                {room?.status === 'playing' && room.turn === currentPlayer?.team && currentPlayer?.role === 'operative' && (
                  <button
                    onClick={endTurn}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2 px-4 rounded-xl text-sm transition-all shadow-md shadow-amber-900/20"
                  >
                    Sırayı Bitir (Pas)
                  </button>
                )}
              </div>

              {/* Game Board Grid */}
              {room?.status === 'lobby' ? (
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-md min-h-[400px] flex flex-col items-center justify-center">
                  <span className="text-6xl mb-4">🎮</span>
                  <h3 className="text-xl font-bold text-white mb-2">Lobi Bekleme Alanı</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
                    Oyuncuların takımlarını ve rollerini seçmesini bekleyin. Hazır olduğunuzda sol taraftaki 
                    <strong> "Oyunu Başlat"</strong> butonuna tıklayarak kelimeleri dağıtın!
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs text-slate-400">
                      🔴 Kırmızı: <strong>{players.filter(p => p.team === 'red').length}</strong> oyuncu
                    </div>
                    <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-xs text-slate-400">
                      🔵 Mavi: <strong>{players.filter(p => p.team === 'blue').length}</strong> oyuncu
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Winner Banner */}
                  {room?.winner && (
                    <div className={`mb-4 p-4 rounded-2xl border text-center shadow-xl animate-bounce ${
                      room.winner === 'red' 
                        ? 'bg-red-950/80 border-red-700 text-red-200' 
                        : 'bg-blue-950/80 border-blue-700 text-blue-200'
                    }`}>
                      <span className="text-3xl block mb-1">🏆</span>
                      <h3 className="text-xl font-black uppercase tracking-wider">
                        {room.winner === 'red' ? '🔴 Kırmızı Takım Kazandı!' : '🔵 Mavi Takım Kazandı!'}
                      </h3>
                      <p className="text-xs mt-1 opacity-80">Tebrikler ajanlar, harika bir iş çıkardınız!</p>
                    </div>
                  )}

                  {/* 5x5 Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {cards.map((card) => {
                      const isSpymaster = currentPlayer?.role === 'spymaster';
                      const showColor = card.revealed || isSpymaster;
                      
                      // Determine card styles based on color and state
                      let cardBg = 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200';
                      let badgeColor = '';

                      if (showColor) {
                        if (card.color === 'red') {
                          cardBg = card.revealed 
                            ? 'bg-gradient-to-br from-red-600 to-red-800 border-red-500 text-white shadow-lg shadow-red-900/30'
                            : 'bg-red-950/40 border-red-900/60 text-red-300 hover:bg-red-950/60';
                          badgeColor = '🔴';
                        } else if (card.color === 'blue') {
                          cardBg = card.revealed
                            ? 'bg-gradient-to-br from-blue-600 to-blue-800 border-blue-500 text-white shadow-lg shadow-blue-900/30'
                            : 'bg-blue-950/40 border-blue-900/60 text-blue-300 hover:bg-blue-950/60';
                          badgeColor = '🔵';
                        } else if (card.color === 'neutral') {
                          cardBg = card.revealed
                            ? 'bg-gradient-to-br from-stone-600 to-stone-700 border-stone-500 text-stone-100'
                            : 'bg-stone-900/40 border-stone-800 text-stone-400 hover:bg-stone-900/60';
                          badgeColor = '⚪';
                        } else if (card.color === 'assassin') {
                          cardBg = card.revealed
                            ? 'bg-gradient-to-br from-stone-900 to-black border-stone-800 text-red-500 shadow-2xl'
                            : 'bg-stone-950 border-stone-900 text-stone-500 hover:bg-stone-900/40';
                          badgeColor = '💀';
                        }
                      }

                      const canClick = 
                        room?.status === 'playing' && 
                        room.turn === currentPlayer?.team && 
                        currentPlayer?.role === 'operative' && 
                        !card.revealed;

                      return (
                        <button
                          key={card.id}
                          onClick={() => revealCard(card)}
                          disabled={!canClick}
                          className={`h-24 rounded-2xl border-2 p-3 flex flex-col justify-between items-center text-center transition-all relative overflow-hidden shadow-md ${
                            canClick ? 'cursor-pointer transform hover:-translate-y-0.5 active:translate-y-0' : 'cursor-default'
                          } ${cardBg}`}
                        >
                          {/* Spymaster indicator badge */}
                          {isSpymaster && (
                            <span className="absolute top-1 right-1.5 text-[10px] opacity-80">
                              {badgeColor} {card.revealed && "✓"}
                            </span>
                          )}

                          {/* Revealed Checkmark */}
                          {card.revealed && (
                            <span className="absolute top-1 left-1.5 text-xs opacity-90">
                              {card.color === 'assassin' ? '💀' : '✓'}
                            </span>
                          )}

                          <div className="my-auto">
                            <span className={`font-bold tracking-wide text-sm sm:text-base uppercase ${
                              card.revealed ? 'line-through opacity-60' : ''
                            }`}>
                              {card.word}
                            </span>
                          </div>

                          {/* Status text for Spymaster */}
                          {isSpymaster && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold opacity-60">
                              {card.revealed ? 'Açıldı' : 'Kapalı'}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Spymaster Clue Input Form */}
              {room?.status === 'playing' && 
               room.turn === currentPlayer?.team && 
               currentPlayer?.role === 'spymaster' && 
               !room.clue_word && (
                <form onSubmit={submitClue} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                  <h4 className="text-sm font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    🕵️‍♂️ Casus İpucu Gönder
                  </h4>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs text-slate-400 font-semibold mb-1.5">İpucu Kelimesi (Tek kelime)</label>
                      <input
                        type="text"
                        required
                        value={clueWordInput}
                        onChange={(e) => setClueWordInput(e.target.value.trim().split(' ')[0])}
                        placeholder="Örn: Mutfak"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition-all text-sm font-medium"
                      />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs text-slate-400 font-semibold mb-1.5">Kart Sayısı</label>
                      <input
                        type="number"
                        min={0}
                        max={9}
                        required
                        value={clueCountInput}
                        onChange={(e) => setClueCountInput(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-yellow-500 transition-all text-sm font-medium text-center"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white font-bold py-2 px-5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-md shadow-yellow-900/20 h-[38px]"
                    >
                      <Send size={16} />
                      İpucu Ver
                    </button>
                  </div>
                </form>
              )}

              {/* Game Logs / History */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <span>📋</span>
                  Oyun Geçmişi
                </h3>
                <div className="bg-slate-950/80 rounded-xl p-3 max-h-36 overflow-y-auto space-y-1.5 border border-slate-800/60">
                  {logs.map((log) => (
                    <div key={log.id} className="text-xs text-slate-300 border-b border-slate-900/50 pb-1 last:border-0">
                      <span className="text-slate-500 mr-2">[{new Date(log.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-xs text-slate-500 italic text-center py-2">Henüz bir hareket yok.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 text-center text-xs text-slate-500 mt-auto">
        <p>© {new Date().getFullYear()} Codenames Online. Arkadaşlarınızla keyifli oyunlar dileriz!</p>
      </footer>
    </div>
  );
}
