import { useState, useRef, useEffect } from "react";

export default function DropdownMenu({ menuData }) {
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  const menuRef = useRef();

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false);
        setSubMenu(null);
        setHoveredItem(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const firstLayerOptions = ["Prompt", "Response", "Prompt and Response"];

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-full transition"
      >
        More
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 w-56 bg-white shadow-lg rounded-md p-2 z-50">
          {firstLayerOptions.map((category) => (
            <div
              key={category}
              className="relative group"
              onMouseEnter={() => setSubMenu(category)}
              onMouseLeave={() => {
                setSubMenu(null);
                setHoveredItem(null);
              }}
            >
              {/* First Layer */}
              <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-800">
                {category}
              </button>

              {/* Second Layer: labels */}
              {subMenu === category && menuData[category] && (
                <div className="absolute top-1/2 left-full -translate-y-1/2 ml-1 w-100 bg-white shadow-lg rounded-md p-2">
                  {menuData[category].map((item, i) => (
                    <button
                      key={i}
                      className="relative w-full text-left px-3 py-2 rounded hover:bg-gray-100 text-gray-800"
                      onMouseEnter={() => setHoveredItem(i)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={() => {
                        item.onClick(); // triggers full question
                        setOpen(false);
                        setSubMenu(null);
                        setHoveredItem(null);
                      }}
                    >
                      {item.label}

                      {/* Hover preview of question */}
                      {hoveredItem === i && (
                        <div className="absolute bottom-full left-20 mb-1 p-1 w-64 bg-gray-100 text-gray-800 text-sm rounded shadow z-50">
                          {item.question.slice(0, 50)}
                          {item.question.length > 50 ? "..." : ""}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
