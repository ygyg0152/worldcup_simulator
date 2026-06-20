// 탭 전환 로직
// "이벤트 위임(Event Delegation)" 패턴: 각 버튼에 따로 리스너를 붙이지 않고
// 부모 요소 하나에 리스너를 붙여서 클릭된 자식이 누군지 확인합니다.

document.addEventListener("DOMContentLoaded", () => {
  // 상위 탭 전환
  const topTabNav = document.querySelector(".top-tabs");
  topTabNav.addEventListener("click", (event) => {
    const btn = event.target.closest(".tab-btn");
    if (!btn) return; // 버튼이 아닌 곳 클릭 시 무시

    const tabName = btn.dataset.tab; // data-tab 속성 읽기

    // 모든 상위 탭 버튼에서 active 제거 후 클릭한 버튼에만 추가
    topTabNav.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // 모든 섹션 숨기고 해당 섹션만 표시
    document.querySelectorAll(".tab-section").forEach((s) => s.classList.remove("active"));
    document.getElementById(`tab-${tabName}`).classList.add("active");
  });

  // 하위 탭 전환 (각 상위 탭 안에 sub-tabs가 있음)
  document.querySelectorAll(".sub-tabs").forEach((subNav) => {
    subNav.addEventListener("click", (event) => {
      const btn = event.target.closest(".tab-btn");
      if (!btn) return;

      const subtabName = btn.dataset.subtab;

      subNav.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // 같은 상위 섹션 안의 subtab-section 들만 토글
      const parentSection = subNav.closest(".tab-section");
      parentSection.querySelectorAll(".subtab-section").forEach((s) => s.classList.remove("active"));
      document.getElementById(`subtab-${subtabName}`).classList.add("active");
    });
  });
});
