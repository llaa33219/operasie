// Injected script - URL 감지 및 code.js 동적 삽입/제거
(() => {
    'use strict';
    
    console.log('[Injected Script] 로드됨');
    
    // 삽입된 script 태그들을 추적
    let injectedScript = null;
    let currentUrl = location.href;
    let isInjecting = false; // 삽입 진행 중 플래그
    
    // 현재 스크립트의 URL에서 extension base URL 추출
    function getExtensionBaseUrl() {
        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            if (script.src && script.src.includes('injected.js')) {
                return script.src.replace('/injected.js', '');
            }
        }
        // fallback: 현재 실행중인 스크립트 추적
        const currentScript = document.currentScript;
        if (currentScript && currentScript.src) {
            return currentScript.src.replace('/injected.js', '');
        }
        return null;
    }
    
    // Entry 객체 완전 로드 대기 함수
    function waitForEntry(target = document) {
        return new Promise((resolve) => {
            let retries = 0;
            
            const checkEntry = () => {
                // Entry 객체가 존재하는지 확인 (target window에서)
                const targetWindow = target === document ? window : (target.defaultView || target.ownerDocument?.defaultView);
                
                if (targetWindow && 
                    targetWindow.Entry && 
                    targetWindow.Entry.engine && 
                    targetWindow.Entry.variableContainer && 
                    targetWindow.Entry.addEventListener &&
                    targetWindow.Entry.block) {
                    console.log('[Injected Script] Entry 객체 완전 로드됨');
                    resolve(targetWindow);
                } else {
                    retries++;
                    // 콘솔 로그를 10번마다만 출력하여 스팸 방지
                    if (retries % 10 === 0) {
                        console.log(`[Injected Script] Entry 로드 대기 중... (${retries}회)`);
                    }
                    setTimeout(checkEntry, 200); // 200ms 간격으로 재시도
                }
            };
            
            checkEntry();
        });
    }
    
    // 이미 삽입되어 있는지 확인하는 함수
    function isCodeScriptInjected(target = document) {
        const targetDoc = target === document ? document : target;
        const existingScripts = targetDoc.querySelectorAll('script[data-entry-modifier="true"]');
        return existingScripts.length > 0;
    }
    
    // code.js를 삽입하는 함수
    function injectCodeScript(target = document) {
        // 이미 삽입 진행 중인 경우 스킵
        if (isInjecting) {
            console.log('[Injected Script] code.js 삽입 진행 중 - 스킵');
            return;
        }
        
        // 이미 삽입된 경우 스킵
        if (isCodeScriptInjected(target)) {
            console.log('[Injected Script] code.js 이미 삽입됨 - 스킵');
            return;
        }
        
        isInjecting = true; // 삽입 시작
        removeCodeScript(); // 기존 스크립트 제거
        
        const extensionBaseUrl = getExtensionBaseUrl();
        if (!extensionBaseUrl) {
            console.error('[Injected Script] Extension base URL을 찾을 수 없음');
            isInjecting = false;
            return;
        }
        
        console.log('[Injected Script] Entry 객체 로드 대기 중...');
        
        // Entry 객체 로드 대기 후 code.js 삽입
        waitForEntry(target)
            .then(() => {
                console.log('[Injected Script] Entry 객체 로드됨, code.js 삽입 시작');
                return fetch(extensionBaseUrl + '/code.js');
            })
            .then(response => response.text())
            .then(codeContent => {
                // 삽입 직전에 한번 더 체크
                if (isCodeScriptInjected(target)) {
                    console.log('[Injected Script] code.js 이미 삽입됨 (삽입 직전 체크) - 스킵');
                    return;
                }
                
                const script = document.createElement('script');
                script.textContent = codeContent; // src 대신 textContent 사용
                script.setAttribute('data-entry-modifier', 'true');
                
                // 타겟에 삽입
                const targetHead = target.head || target.documentElement || target;
                if (targetHead) {
                    targetHead.appendChild(script);
                    injectedScript = script;
                    console.log('[Injected Script] code.js 인라인 삽입 완료:', target === document ? '호스트 페이지' : 'iframe');
                }
            })
            .catch(error => {
                console.error('[Injected Script] code.js 로드 실패:', error);
            })
            .finally(() => {
                isInjecting = false; // 삽입 완료 (성공/실패 관계없이)
            });
    }
    
    // code.js 제거 함수
    function removeCodeScript() {
        if (injectedScript && injectedScript.parentNode) {
            injectedScript.remove();
            console.log('[Injected Script] code.js 제거됨');
        }
        injectedScript = null;
        isInjecting = false; // 플래그 리셋
        
        // 모든 data-entry-modifier script 태그 제거
        document.querySelectorAll('script[data-entry-modifier="true"]').forEach(script => {
            script.remove();
        });
        
        // iframe 내부의 script도 제거
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc) {
                    iframeDoc.querySelectorAll('script[data-entry-modifier="true"]').forEach(script => {
                        script.remove();
                    });
                }
            } catch (e) {
                // Cross-origin iframe일 수 있으므로 무시
            }
        });
    }
    
    // iframe 찾기 (project/* 경로용)
    function findTargetIframe() {
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                // iframe이 로드되고 접근 가능한지 확인
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                const iframeWindow = iframe.contentWindow;
                
                if (iframeDoc && iframeWindow) {
                    // iframe이 완전히 로드되었는지 확인
                    if (iframeDoc.readyState === 'complete' || 
                        (iframeDoc.readyState === 'interactive' && iframeWindow.Entry)) {
                        // Entry가 있는 iframe을 우선적으로 선택
                        if (iframeWindow.Entry || iframeDoc.querySelector('script[src*="entry"]')) {
                            console.log('[Injected Script] Entry가 있는 iframe 발견');
                            return iframeDoc;
                        }
                        // 그 외의 로드된 iframe도 후보로 고려
                        return iframeDoc;
                    }
                    // loading 상태지만 DOM이 있으면 후보로 고려
                    if (iframeDoc.readyState === 'loading' && iframeDoc.body) {
                        return iframeDoc;
                    }
                }
            } catch (e) {
                // Cross-origin iframe이거나 접근 불가능한 경우
                console.log('[Injected Script] iframe 접근 불가 (cross-origin 또는 로딩 중):', e.message);
                continue;
            }
        }
        return null;
    }
    
    // URL에 따른 code.js 처리
    function handleUrlChange() {
        const url = location.href;
        console.log('[Injected Script] URL 변경 감지:', url);
        
        // URL 패턴 확인
        if (url.includes('playentry.org/ws/') || 
            url.includes('playentry.org/iframe/') || 
            url.includes('playentry.org/noframe/')) {
            // 호스트 페이지에 삽입
            console.log('[Injected Script] 호스트 페이지에 code.js 삽입');
            injectCodeScript(document);
        } 
        else if (url.includes('playentry.org/project/')) {
            // iframe 찾아서 삽입 (더 강력한 재시도 로직)
            console.log('[Injected Script] iframe 찾는 중...');
            
            const tryInjectToIframe = (retries = 20) => {
                const iframeDoc = findTargetIframe();
                if (iframeDoc) {
                    console.log('[Injected Script] iframe 발견, code.js 삽입');
                    injectCodeScript(iframeDoc);
                } else if (retries > 0) {
                    // iframe 로딩을 위해 잠시 대기 후 재시도 (더 긴 간격)
                    const delay = retries > 15 ? 300 : retries > 10 ? 500 : 1000;
                    setTimeout(() => tryInjectToIframe(retries - 1), delay);
                } else {
                    console.log('[Injected Script] iframe을 찾을 수 없음, 호스트 페이지에도 시도');
                    // iframe을 찾지 못한 경우에도 호스트 페이지에 삽입 시도
                    injectCodeScript(document);
                    
                    // iframe 로드를 위한 추가 대기 후 한번 더 시도
                    setTimeout(() => {
                        const iframeDoc = findTargetIframe();
                        if (iframeDoc && !isCodeScriptInjected(iframeDoc)) {
                            console.log('[Injected Script] 지연된 iframe 발견, code.js 삽입');
                            injectCodeScript(iframeDoc);
                        }
                    }, 3000);
                }
            };
            
            // iframe 로드 이벤트 리스너도 추가
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(iframe => {
                iframe.addEventListener('load', () => {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc && !isCodeScriptInjected(iframeDoc)) {
                        console.log('[Injected Script] iframe 로드 이벤트로 code.js 삽입');
                        injectCodeScript(iframeDoc);
                    }
                });
            });
            
            tryInjectToIframe();
        } 
        else {
            // 매칭되지 않는 URL이면 제거
            console.log('[Injected Script] 매칭되지 않는 URL, code.js 제거');
            removeCodeScript();
        }
        
        currentUrl = url;
    }
    
    // 초기 URL 처리
    handleUrlChange();
    
    // URL 변경 감지
    // History API 감지
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
        originalPushState.apply(history, args);
        setTimeout(handleUrlChange, 100);
    };
    
    history.replaceState = function(...args) {
        originalReplaceState.apply(history, args);
        setTimeout(handleUrlChange, 100);
    };
    
    // popstate 이벤트 감지
    window.addEventListener('popstate', () => {
        setTimeout(handleUrlChange, 100);
    });
    
    // URL 변경을 주기적으로 체크 (fallback)
    setInterval(() => {
        if (currentUrl !== location.href) {
            handleUrlChange();
        }
    }, 1000);
    
    // 동적으로 추가되는 iframe 감지를 위한 MutationObserver
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // iframe이 추가된 경우
                    if (node.tagName === 'IFRAME') {
                        handleNewIframe(node);
                    }
                    // iframe을 포함하는 요소가 추가된 경우
                    const iframes = node.querySelectorAll && node.querySelectorAll('iframe');
                    if (iframes) {
                        iframes.forEach(handleNewIframe);
                    }
                }
            });
        });
    });
    
    // 새로운 iframe 처리 함수
    function handleNewIframe(iframe) {
        // project 페이지에서만 iframe 처리
        if (!location.href.includes('playentry.org/project/')) return;
        
        console.log('[Injected Script] 새로운 iframe 감지');
        
        // iframe 로드 이벤트 리스너 추가
        iframe.addEventListener('load', () => {
            setTimeout(() => {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                    if (iframeDoc && !isCodeScriptInjected(iframeDoc)) {
                        console.log('[Injected Script] 새 iframe에 code.js 삽입');
                        injectCodeScript(iframeDoc);
                    }
                } catch (e) {
                    console.log('[Injected Script] 새 iframe 접근 실패:', e.message);
                }
            }, 500);
        });
        
        // 이미 로드된 iframe인 경우 즉시 처리
        setTimeout(() => {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                if (iframeDoc && iframeDoc.readyState !== 'loading' && !isCodeScriptInjected(iframeDoc)) {
                    console.log('[Injected Script] 로드된 새 iframe에 code.js 삽입');
                    injectCodeScript(iframeDoc);
                }
            } catch (e) {
                // iframe이 아직 로드되지 않았거나 cross-origin
            }
        }, 100);
    }
    
    // DOM 변경 감지 시작
    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });
    
    console.log('[Injected Script] URL 감지 및 iframe 모니터링 설정 완료');
})();
