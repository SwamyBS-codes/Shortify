// import { useState, useEffect } from 'react';

// // Child Component
// function LiveClock() {
//   useEffect(() => {
//     // 1. MOUNTING: Start a timer when component appears
//     const timerId = setInterval(() => {
//       console.log("Tick... updating clock");
//     }, 1000);

//     // 2. UNMOUNTING: React automatically executes this return function
//     // right before removing the component from the DOM!
//     return () => {
//       clearInterval(timerId); // Stop the background timer
//       console.log("Cleaned up! Timer stopped because component was removed.");
//     };
//   }, []);

//   return <div>Live Clock Component</div>;
// }

// // Parent Component (Toggles the child on and off)
// function App() {
//   const [showClock, setShowClock] = useState(true);

//   return (
//     <div>
//       <button onClick={() => setShowClock(!showClock)}>
//         Toggle Clock
//       </button>

//       {/* When showClock becomes false, LiveClock UNMOUNTS (removed from DOM) */}
//       {showClock && <LiveClock />}
//     </div>
//   );
// }
// export default App




// import React, { useRef, useState } from 'react'

// const App = () => {
//   const [seconds, setSeconds] = useState(0);

//   // Store the timer ID in a ref so it doesn't trigger re-renders when updated
//   const timerIdRef = useRef(null);

//   const startTimer = () => {
//     if (timerIdRef.current !== null) return; // Prevent multiple timers

//     timerIdRef.current = setInterval(() => {
//       setSeconds((prev) => prev + 1);
//     }, 1000);
//   };

//   const stopTimer = () => {
//     clearInterval(timerIdRef.current);
//     timerIdRef.current = null; // Reset ref container
//   };
//   return (
//     <div>
//       <h1>Time Elapsed: {seconds}s</h1>
//       <button onClick={startTimer}>Start</button>
//       <button onClick={stopTimer}>Stop</button>
//     </div>
//   )
// }

// export default App


import React, { useRef } from 'react'

const App = () => {
  const inputRef=useRef(null);
  
  return (
    <div>
      <input ref={inputRef}/>
      <button onClick={()=>inputRef.current.focus()}>Focus input</button>
    </div>
  )
}

export default App

