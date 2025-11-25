// Smooth scroll when clicking the arrow
document.addEventListener("DOMContentLoaded", function() {
  const arrow = document.querySelector(".scroll-down-arrow");
  const section = document.getElementById("prepare-start");

  if (arrow && section) {
    arrow.addEventListener("click", function(e) {
      e.preventDefault();
      section.scrollIntoView({ behavior: "smooth" });
    });
  }

  console.log("Prepare page script loaded.");
});