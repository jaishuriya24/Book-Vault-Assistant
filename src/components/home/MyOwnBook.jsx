import { useNavigate } from "react-router-dom";

export default function MyOwnBook() {
  const navigate = useNavigate();
  
  return (
    <div 
      onClick={() => navigate("/add-book")}
      className="bg-stone-50 p-6 rounded-3xl shadow-sm border border-stone-200 hover:shadow-md transition-all duration-300 group cursor-pointer"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
          ✍️
        </div>
        <h2 className="text-xl font-serif text-slate-800 group-hover:text-blue-600 transition-colors">
          My Own Book
        </h2>
      </div>
      <div className="h-40 bg-stone-100/50 rounded-2xl flex flex-col items-center justify-center text-stone-400 border-2 border-stone-200 border-dashed group-hover:border-blue-200 transition-colors">
        <span className="text-2xl mb-2">✨</span>
        <span className="text-sm">Start drafting today</span>
      </div>
    </div>
  );
}
