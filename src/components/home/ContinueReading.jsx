import { useNavigate } from "react-router-dom";

export default function ContinueReading() {
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={() => navigate("/continue-reading")}
      className="bg-stone-50 p-6 rounded-3xl shadow-sm border border-stone-200 hover:shadow-md transition-all duration-300 group cursor-pointer h-full flex flex-col"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shadow-sm group-hover:scale-110 transition-transform">
          📖
        </div>
        <h2 className="text-xl font-serif text-slate-800 group-hover:text-orange-600 transition-colors">
          Continue Reading
        </h2>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center text-stone-400">
        <span className="text-sm font-medium">View books in progress →</span>
      </div>
    </div>
  );
}
