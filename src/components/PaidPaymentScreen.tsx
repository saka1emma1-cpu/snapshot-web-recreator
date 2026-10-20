import { useState } from "react";

export default function PaidPaymentScreen({ onPaid }: { onPaid: () => void }) {
  const [proof, setProof] = useState("");

  return (
    <div className="p-4 bg-yellow-50 min-h-screen max-w-md mx-auto">
      <h1 className="text-2xl font-bold">YARA PAID ROOM - N500</h1>
      <p className="mt-2">Pot: N2000 (4 players x N500)</p>
      <p>Winner gets: N1600</p>
      <p>You (Host) keep: N400</p>
      <div className="mt-4 p-3 bg-white rounded border">
        <p className="font-bold">Send N500 to:</p>
        <p>Opay: 8066316416</p>
        <p>Name: SAKA EMMANUEL</p>
      </div>
      <input 
        className="mt-4 w-full p-3 border rounded"
        placeholder="Paste payment proof / transaction ID"
        value={proof} onChange={e=>setProof(e.target.value)}
      />
      <button 
        onClick={()=>{
          localStorage.setItem("yara_paid_status","confirmed");
          localStorage.setItem("yara_paid_proof",proof);
          onPaid();
        }}
        className="mt-3 w-full bg-green-600 text-white p-3 rounded font-bold"
      >
        I Have Paid - Join Game
      </button>
    </div>
  );
}
