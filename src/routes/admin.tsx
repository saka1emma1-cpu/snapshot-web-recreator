import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
  component: Admin,
})

function Admin() {
  const lastWinner = typeof window !== 'undefined' ? localStorage.getItem("yara_last_winner") : null;
  const lastColor = typeof window !== 'undefined' ? localStorage.getItem("yara_last_winner_color") : null;
  const history = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem("yara_winners_history") || "[]") : [];

  return (
    <div style={{padding:20, maxWidth:500, margin:'0 auto'}}>
      <h1 style={{fontSize:24, fontWeight:'bold'}}>YARA Admin - Winner Tracker</h1>
      <div style={{marginTop:16, background:'#dcfce7', padding:16, borderRadius:12}}>
        <h2>Last Winner:</h2>
        <p style={{fontSize:20, fontWeight:'bold'}}>{lastWinner ? `${lastWinner} - ${lastColor}` : "No winner yet - play a game"}</p>
        <p>For PAID: Send N1600 to winner</p>
        <p>Your profit: N400 to Opay 8066316416 SAKA EMMANUEL</p>
      </div>
      <h2 style={{marginTop:24, fontWeight:'bold'}}>Paid Winners History ({history.length}):</h2>
      {history.map((h:any,i:number)=>
        <div key={i} style={{marginTop:8, background:'white', padding:12, borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
          {h.time} - <b>{h.name}</b> ({h.color}) - N{h.winnerGets} | You: N{h.hostGets}
        </div>
      )}
    </div>
  )
}
