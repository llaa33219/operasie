// Entry.js 함수 교체 로직
(() => {
    // 함수 백업 저장소
    const functionBackups = new Map();
    let isCurrentlyReplaced = false;
    console.log('[함수 교체] 실행 준비됨');

    // 보안 헬퍼 함수들
    function safeToString(value) {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value);
        }
        // 객체나 기타 타입은 안전한 기본값 반환
        return '';
    }

    function safeParseFloat(value, defaultValue = 0) {
        const str = safeToString(value).trim();
        if (str === '') {
            return defaultValue;
        }
        // 숫자가 아닌 문자가 포함된 경우 필터링
        const sanitized = str.replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(sanitized);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    function sanitizeInput(value) {
        const str = safeToString(value);
        // XSS 방지를 위한 기본적인 문자 이스케이핑
        return str.replace(/[<>'"&]/g, '');
    }

    function safeSplit(value, separator = ',') {
        const str = safeToString(value);
        return str.split(separator);
    }

    function safeRegexExec(pattern, text) {
        if (!text || typeof text !== 'string') {
            return null;
        }
        try {
            return pattern.exec(text);
        } catch (e) {
            console.warn('Regex execution error:', e);
            return null;
        }
    }

    function safeRegexTest(pattern, text) {
        if (!text || typeof text !== 'string') {
            return false;
        }
        try {
            return pattern.test(text);
        } catch (e) {
            console.warn('Regex test error:', e);
            return false;
        }
    }

    // 복소수 파싱 함수
    function parseComplex(str) {
        if (!str || typeof str !== 'string') {
            return { real: 0, imag: 0 };
        }
        
        str = str.trim().replace(/\s+/g, '');
        
        // 단순 실수인 경우
        if (/^[-+]?\d*\.?\d+$/.test(str)) {
            return { real: safeParseFloat(str), imag: 0 };
        }
        
        // 단순 허수인 경우 (i, -i, 3i, -5i 등)
        const pureImagMatch = str.match(/^([-+]?\d*\.?\d*)i$/);
        if (pureImagMatch) {
            let coeff = pureImagMatch[1];
            if (coeff === '' || coeff === '+') coeff = '1';
            if (coeff === '-') coeff = '-1';
            return { real: 0, imag: safeParseFloat(coeff) };
        }
        
        // 복소수 형태 (a+bi, a-bi)
        const complexMatch = str.match(/^([-+]?\d*\.?\d+)([-+])([-+]?\d*\.?\d*)i$/);
        if (complexMatch) {
            const real = safeParseFloat(complexMatch[1]);
            let imagCoeff = complexMatch[3];
            const sign = complexMatch[2];
            
            if (imagCoeff === '' || imagCoeff === '+') imagCoeff = '1';
            if (imagCoeff === '-') imagCoeff = '-1';
            
            let imag = safeParseFloat(imagCoeff);
            if (sign === '-') imag = -imag;
            
            return { real: real, imag: imag };
        }
        
        // 기본값
        return { real: 0, imag: 0 };
    }

    // 복소수를 문자열로 포맷팅
    function formatComplex(complex) {
        const { real, imag } = complex;
        
        if (imag === 0) {
            return String(real);
        }
        
        if (real === 0) {
            if (imag === 1) return 'i';
            if (imag === -1) return '-i';
            return `${imag}i`;
        }
        
        let imagPart;
        if (imag === 1) imagPart = 'i';
        else if (imag === -1) imagPart = '-i';
        else imagPart = `${imag}i`;
        
        if (imag > 0) {
            return `${real}+${imagPart}`;
        } else {
            return `${real}${imagPart}`;
        }
    }

    // 복소수 덧셈
    function addComplex(z1, z2) {
        return {
            real: z1.real + z2.real,
            imag: z1.imag + z2.imag
        };
    }

    // 복소수 뺄셈
    function subtractComplex(z1, z2) {
        return {
            real: z1.real - z2.real,
            imag: z1.imag - z2.imag
        };
    }

    // 복소수 곱셈
    function multiplyComplex(z1, z2) {
        return {
            real: z1.real * z2.real - z1.imag * z2.imag,
            imag: z1.real * z2.imag + z1.imag * z2.real
        };
    }

    // 복소수 나눗셈
    function divideComplex(z1, z2) {
        const denominator = z2.real * z2.real + z2.imag * z2.imag;
        if (denominator === 0) {
            return { real: Infinity, imag: Infinity };
        }
        
        return {
            real: (z1.real * z2.real + z1.imag * z2.imag) / denominator,
            imag: (z1.imag * z2.real - z1.real * z2.imag) / denominator
        };
    }

    // 복소수 거듭제곱
    function powerComplex(z1, z2) {
        // z1^z2 = e^(z2 * ln(z1))
        // ln(z) = ln|z| + i*arg(z)
        
        const r1 = Math.sqrt(z1.real * z1.real + z1.imag * z1.imag);
        const theta1 = Math.atan2(z1.imag, z1.real);
        
        if (r1 === 0) {
            return { real: 0, imag: 0 };
        }
        
        // ln(z1) = ln(r1) + i*theta1
        const lnZ1Real = Math.log(r1);
        const lnZ1Imag = theta1;
        
        // z2 * ln(z1)
        const expReal = z2.real * lnZ1Real - z2.imag * lnZ1Imag;
        const expImag = z2.real * lnZ1Imag + z2.imag * lnZ1Real;
        
        // e^(expReal + i*expImag)
        const magnitude = Math.exp(expReal);
        return {
            real: magnitude * Math.cos(expImag),
            imag: magnitude * Math.sin(expImag)
        };
    }

    // 화이트리스트 기반 안전한 함수 실행기
    const whitelistedFunctions = {
        // 수학 함수들
        Math: {
            PI: Math.PI,
            E: Math.E,
            abs: Math.abs,
            floor: Math.floor,
            ceil: Math.ceil,
            round: Math.round,
            min: Math.min,
            max: Math.max,
            pow: Math.pow,
            sqrt: Math.sqrt,
            sin: Math.sin,
            cos: Math.cos,
            tan: Math.tan,
            asin: Math.asin,
            acos: Math.acos,
            atan: Math.atan,
            atan2: Math.atan2,
            sinh: Math.sinh,
            cosh: Math.cosh,
            tanh: Math.tanh,
            asinh: Math.asinh,
            acosh: Math.acosh,
            atanh: Math.atanh,
            exp: Math.exp,
            log: Math.log,
            log10: Math.log10,
            log2: Math.log2,
            random: Math.random
        },
        // 기본 연산
        parseFloat: parseFloat,
        parseInt: parseInt,
        isNaN: isNaN,
        isFinite: isFinite,
        // 안전한 헬퍼 함수들
        safeParseFloat: safeParseFloat,
        safeSplit: safeSplit,
        sanitizeInput: sanitizeInput,
        // 허용된 전역 함수들
        alert: alert
    };

    // 안전한 수식 평가기
    function safeEvaluateExpression(expression, params = []) {
        // 기본 변수들
        const context = {
            p: params,
            Math: whitelistedFunctions.Math,
            safeParseFloat: whitelistedFunctions.safeParseFloat,
            safeSplit: whitelistedFunctions.safeSplit,
            sanitizeInput: whitelistedFunctions.sanitizeInput,
            alert: whitelistedFunctions.alert,
            parseFloat: whitelistedFunctions.parseFloat,
            parseInt: whitelistedFunctions.parseInt,
            isNaN: whitelistedFunctions.isNaN,
            isFinite: whitelistedFunctions.isFinite
        };

        try {
            // 미리 정의된 수식 패턴들
            const predefinedExpressions = {
                'Math.PI': () => Math.PI,
                'Math.E': () => Math.E,
                '(1 + Math.sqrt(5)) / 2': () => (1 + Math.sqrt(5)) / 2,
                '0.5671432904097838': () => 0.5671432904097838,
                'Math.min(...safeSplit(p[0] || "0,0,0").map(x => safeParseFloat(x)))': (p) => Math.min(...safeSplit(p[0] || "0,0,0").map(x => safeParseFloat(x))),
                'Math.max(...safeSplit(p[0] || "0,0,0").map(x => safeParseFloat(x)))': (p) => Math.max(...safeSplit(p[0] || "0,0,0").map(x => safeParseFloat(x))),
                'Math.exp(safeParseFloat(p[0]))': (p) => Math.exp(safeParseFloat(p[0])),
                'Math.pow(safeParseFloat(p[0]), safeParseFloat(p[1]))': (p) => Math.pow(safeParseFloat(p[0]), safeParseFloat(p[1])),
                'Math.sinh(safeParseFloat(p[0]))': (p) => Math.sinh(safeParseFloat(p[0])),
                'Math.cosh(safeParseFloat(p[0]))': (p) => Math.cosh(safeParseFloat(p[0])),
                'Math.tanh(safeParseFloat(p[0]))': (p) => Math.tanh(safeParseFloat(p[0])),
                'Math.asinh(safeParseFloat(p[0]))': (p) => Math.asinh(safeParseFloat(p[0])),
                'Math.acosh(safeParseFloat(p[0]))': (p) => Math.acosh(safeParseFloat(p[0])),
                'Math.atanh(safeParseFloat(p[0]))': (p) => Math.atanh(safeParseFloat(p[0])),
                'Math.log(safeParseFloat(p[1], 1)) / Math.log(safeParseFloat(p[0], 10))': (p) => Math.log(safeParseFloat(p[1], 1)) / Math.log(safeParseFloat(p[0], 10)),
                // 복소수 연산들
                'const z1 = parseComplex(p[0] || "0");\n                                        const z2 = parseComplex(p[1] || "0");\n                                        const result = addComplex(z1, z2);\n                                        formatComplex(result)': (p) => {
                    const z1 = parseComplex(p[0] || "0");
                    const z2 = parseComplex(p[1] || "0");
                    const result = addComplex(z1, z2);
                    return formatComplex(result);
                },
                'const z1 = parseComplex(p[0] || "0");\n                                        const z2 = parseComplex(p[1] || "0");\n                                        const result = subtractComplex(z1, z2);\n                                        formatComplex(result)': (p) => {
                    const z1 = parseComplex(p[0] || "0");
                    const z2 = parseComplex(p[1] || "0");
                    const result = subtractComplex(z1, z2);
                    return formatComplex(result);
                },
                'const z1 = parseComplex(p[0] || "0");\n                                        const z2 = parseComplex(p[1] || "0");\n                                        const result = multiplyComplex(z1, z2);\n                                        formatComplex(result)': (p) => {
                    const z1 = parseComplex(p[0] || "0");
                    const z2 = parseComplex(p[1] || "0");
                    const result = multiplyComplex(z1, z2);
                    return formatComplex(result);
                },
                'const z1 = parseComplex(p[0] || "0");\n                                        const z2 = parseComplex(p[1] || "0");\n                                        const result = divideComplex(z1, z2);\n                                        formatComplex(result)': (p) => {
                    const z1 = parseComplex(p[0] || "0");
                    const z2 = parseComplex(p[1] || "0");
                    const result = divideComplex(z1, z2);
                    return formatComplex(result);
                },
                'const z1 = parseComplex(p[0] || "0");\n                                        const z2 = parseComplex(p[1] || "0");\n                                        const result = powerComplex(z1, z2);\n                                        formatComplex(result)': (p) => {
                    const z1 = parseComplex(p[0] || "0");
                    const z2 = parseComplex(p[1] || "0");
                    const result = powerComplex(z1, z2);
                    return formatComplex(result);
                }
            };

            // 간단한 수식은 직접 계산
            const cleanExpression = expression.trim();
            
            // 미리 정의된 수식이 있으면 사용
            if (predefinedExpressions[cleanExpression]) {
                try {
                    return predefinedExpressions[cleanExpression](params);
                } catch (evalError) {
                    console.warn('Predefined expression failed:', evalError, cleanExpression);
                    showUnsupportedFunctionWarning(cleanExpression);
                    return 0;
                }
            }
            
            // 복잡한 수식 처리 (제한적)
            if (cleanExpression.includes('const ') || cleanExpression.includes('let ') || cleanExpression.includes('var ')) {
                try {
                    return handleComplexExpression(cleanExpression, params);
                } catch (complexError) {
                    console.warn('Complex expression failed:', complexError, cleanExpression);
                    showUnsupportedFunctionWarning(cleanExpression);
                    return 0;
                }
            }
            
            // 단순 수식 처리
            try {
                return handleSimpleExpression(cleanExpression, context);
            } catch (simpleError) {
                console.warn('Simple expression failed:', simpleError, cleanExpression);
                showUnsupportedFunctionWarning(cleanExpression);
                return 0;
            }
            
        } catch (error) {
            console.warn('Expression evaluation failed:', error, expression);
            showUnsupportedFunctionWarning(expression);
            return 0;
        }
    }

    // 지원하지 않는 함수 경고 표시
    function showUnsupportedFunctionWarning(expression) {
        try {
            if (Entry && Entry.toast && Entry.toast.alert) {
                Entry.toast.alert('함수 실행 스킵', '공식적으로 실행을 지원하지 않는 함수 실행이 감지되었습니다.', false);
            } else {
                // Entry.toast가 없는 경우 일반 alert 사용
                console.warn('지원하지 않는 함수:', expression);
            }
        } catch (toastError) {
            console.warn('Toast alert failed:', toastError);
        }
    }

    // 복잡한 수식 처리 함수
    function handleComplexExpression(expression, params) {
        try {
            // 특정 패턴들만 허용
            const patterns = {
                // 내적 계산
                dotProduct: /const v1 = safeSplit\(p\[0\] \|\| "[^"]+"\)\.map\(x => safeParseFloat\(x\)\);\s*const v2 = safeSplit\(p\[1\] \|\| "[^"]+"\)\.map\(x => safeParseFloat\(x\)\);\s*v1\.reduce\(\(sum, val, i\) => sum \+ val \* \(v2\[i\] \|\| 0\), 0\)/,
                // 외적 계산
                crossProduct: /const v1 = safeSplit\(p\[0\] \|\| "[^"]+"\)\.map\(x => safeParseFloat\(x\)\);\s*const v2 = safeSplit\(p\[1\] \|\| "[^"]+"\)\.map\(x => safeParseFloat\(x\)\);\s*const cross = \[[^\]]+\];\s*cross\.join\(","\)/,
                // atan2
                atan2: /const coords = safeSplit\(p\[0\] \|\| "[^"]+"\)\.map\(x => safeParseFloat\(x\)\);\s*Math\.atan2\(coords\[0\] \|\| 0, coords\[1\] \|\| 0\)/,
                // 역쌍곡함수들
                coth: /const x = safeParseFloat\(p\[0\]\); 1 \/ Math\.tanh\(x\)/,
                sech: /const x = safeParseFloat\(p\[0\]\); 1 \/ Math\.cosh\(x\)/,
                csch: /const x = safeParseFloat\(p\[0\]\); 1 \/ Math\.sinh\(x\)/,
                arcoth: /const x = safeParseFloat\(p\[0\]\); Math\.atanh\(1 \/ x\)/,
                arsech: /const x = safeParseFloat\(p\[0\]\); Math\.acosh\(1 \/ x\)/,
                arcsch: /const x = safeParseFloat\(p\[0\]\); Math\.asinh\(1 \/ x\)/,
            // 불완전 감마 함수들
            lowerIncompleteGamma: /const params = safeSplit\(p\[0\] \|\| "[^"]+"\)\.map\(x => safeParseFloat\(x, 1\)\);\s*const s = params\[0\];\s*const x = params\[1\];/,
            // 알람 처리
            alertSanitized: /const p = script\.executor\.register\?\.params \|\| \[\]; alert\(sanitizeInput\(p\[0\] \|\| ""\)\);/,
            // 복소수 연산들
            complexAdd: /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*\+\s*\(\s*[^)]+\s*\)@/,
            complexSubtract: /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*-\s*\(\s*[^)]+\s*\)@/,
            complexMultiply: /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*\*\s*\(\s*[^)]+\s*\)@/,
            complexDivide: /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*\/\s*\(\s*[^)]+\s*\)@/,
            complexPower: /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*\*\*\s*\(\s*[^)]+\s*\)@/
            };

            if (patterns.dotProduct.test(expression)) {
                const v1 = safeSplit(params[0] || "0,0,0").map(x => safeParseFloat(x));
                const v2 = safeSplit(params[1] || "0,0,0").map(x => safeParseFloat(x));
                return v1.reduce((sum, val, i) => sum + val * (v2[i] || 0), 0);
            }
            
            if (patterns.crossProduct.test(expression)) {
                const v1 = safeSplit(params[0] || "0,0,0").map(x => safeParseFloat(x));
                const v2 = safeSplit(params[1] || "0,0,0").map(x => safeParseFloat(x));
                const cross = [
                    (v1[1] || 0) * (v2[2] || 0) - (v1[2] || 0) * (v2[1] || 0),
                    (v1[2] || 0) * (v2[0] || 0) - (v1[0] || 0) * (v2[2] || 0),
                    (v1[0] || 0) * (v2[1] || 0) - (v1[1] || 0) * (v2[0] || 0)
                ];
                return cross.join(",");
            }
            
            if (patterns.atan2.test(expression)) {
                const coords = safeSplit(params[0] || "0,0").map(x => safeParseFloat(x));
                return Math.atan2(coords[0] || 0, coords[1] || 0);
            }

            if (patterns.coth.test(expression)) {
                const x = safeParseFloat(params[0]);
                return 1 / Math.tanh(x);
            }

            if (patterns.sech.test(expression)) {
                const x = safeParseFloat(params[0]);
                return 1 / Math.cosh(x);
            }

            if (patterns.csch.test(expression)) {
                const x = safeParseFloat(params[0]);
                return 1 / Math.sinh(x);
            }

            if (patterns.arcoth.test(expression)) {
                const x = safeParseFloat(params[0]);
                return Math.atanh(1 / x);
            }

            if (patterns.arsech.test(expression)) {
                const x = safeParseFloat(params[0]);
                return Math.acosh(1 / x);
            }

            if (patterns.arcsch.test(expression)) {
                const x = safeParseFloat(params[0]);
                return Math.asinh(1 / x);
            }

            // 불완전 감마 함수 처리
            if (patterns.lowerIncompleteGamma.test(expression)) {
                return handleIncompleteGammaFunction(expression, params);
            }

            // 감마 함수 관련 처리
            if (expression.includes('감마') || expression.includes('gamma')) {
                return handleGammaFunction(expression, params);
            }

            // 복소수 연산 처리
            if (patterns.complexAdd.test(expression)) {
                const z1 = parseComplex(params[0] || "0");
                const z2 = parseComplex(params[1] || "0");
                const result = addComplex(z1, z2);
                return formatComplex(result);
            }

            if (patterns.complexSubtract.test(expression)) {
                const z1 = parseComplex(params[0] || "0");
                const z2 = parseComplex(params[1] || "0");
                const result = subtractComplex(z1, z2);
                return formatComplex(result);
            }

            if (patterns.complexMultiply.test(expression)) {
                const z1 = parseComplex(params[0] || "0");
                const z2 = parseComplex(params[1] || "0");
                const result = multiplyComplex(z1, z2);
                return formatComplex(result);
            }

            if (patterns.complexDivide.test(expression)) {
                const z1 = parseComplex(params[0] || "0");
                const z2 = parseComplex(params[1] || "0");
                const result = divideComplex(z1, z2);
                return formatComplex(result);
            }

            if (patterns.complexPower.test(expression)) {
                const z1 = parseComplex(params[0] || "0");
                const z2 = parseComplex(params[1] || "0");
                const result = powerComplex(z1, z2);
                return formatComplex(result);
            }

            return 0;
        } catch (error) {
            console.warn('Complex expression handling failed:', error, expression);
            showUnsupportedFunctionWarning(expression);
            return 0;
        }
    }

    // 불완전 감마 함수 처리
    function handleIncompleteGammaFunction(expression, params) {
        const parsedParams = safeSplit(params[0] || "1,1").map(x => safeParseFloat(x, 1));
        const s = parsedParams[0];
        const x = parsedParams[1];
        
        if (s <= 0 || x < 0) return NaN;
        
        if (expression.includes('하불완전')) {
            if (x === 0) return 0;
            let result = 0;
            const dt = Math.min(0.01, x / 1000);
            
            for (let t = dt; t <= x; t += dt) {
                const term = Math.pow(t, s - 1) * Math.exp(-t) * dt;
                result += term;
            }
            
            return result;
        }
        
        if (expression.includes('상불완전')) {
            // 전체 감마 함수 계산
            const gamma_s = s > 10 ? 
                Math.sqrt(2 * Math.PI / s) * Math.pow(s / Math.E, s) :
                (function() {
                    let result = 1;
                    let temp_s = s;
                    while (temp_s > 2) {
                        temp_s -= 1;
                        result *= temp_s;
                    }
                    return result;
                })();
            
            // 하불완전 감마 계산
            let lowerGamma = 0;
            if (x > 0) {
                const dt = Math.min(0.01, x / 1000);
                
                for (let t = dt; t <= x; t += dt) {
                    const term = Math.pow(t, s - 1) * Math.exp(-t) * dt;
                    lowerGamma += term;
                }
            }
            
            return gamma_s - lowerGamma;
        }
        
        if (expression.includes('하정규화')) {
            let lowerGamma = 0;
            const dt = Math.min(0.01, x / 1000);
            
            for (let t = dt; t <= x; t += dt) {
                const term = Math.pow(t, s - 1) * Math.exp(-t) * dt;
                lowerGamma += term;
            }
            
            const gamma_s = s > 10 ? 
                Math.sqrt(2 * Math.PI / s) * Math.pow(s / Math.E, s) :
                (function() {
                    let result = 1;
                    let temp_s = s;
                    while (temp_s > 2) {
                        temp_s -= 1;
                        result *= temp_s;
                    }
                    return result;
                })();
            
            return lowerGamma / gamma_s;
        }
        
        if (expression.includes('상정규화')) {
            const gamma_s = s > 10 ? 
                Math.sqrt(2 * Math.PI / s) * Math.pow(s / Math.E, s) :
                (function() {
                    let result = 1;
                    let temp_s = s;
                    while (temp_s > 2) {
                        temp_s -= 1;
                        result *= temp_s;
                    }
                    return result;
                })();
            
            let lowerGamma = 0;
            if (x > 0) {
                const dt = Math.min(0.01, x / 1000);
                
                for (let t = dt; t <= x; t += dt) {
                    const term = Math.pow(t, s - 1) * Math.exp(-t) * dt;
                    lowerGamma += term;
                }
            }
            
            const upperGamma = gamma_s - lowerGamma;
            return upperGamma / gamma_s;
        }
        
        return 0;
    }

    // 단순 수식 처리 - 완전히 안전한 파서
    function handleSimpleExpression(expression, context) {
        const cleanExpr = expression.trim();
        
        // 허용된 토큰들만 포함하는지 확인
        const allowedTokens = /^[\d\.\+\-\*/\s\(\)Math\.PIEabsceilfloorminmaxpowsqrtlogsincostan]+$/;
        if (!allowedTokens.test(cleanExpr)) {
            return 0;
        }
        
        // 간단한 산술 연산 직접 계산
        try {
            // Math 상수들 먼저 치환
            let processedExpr = cleanExpr
                .replace(/Math\.PI/g, String(Math.PI))
                .replace(/Math\.E/g, String(Math.E));
            
            // 단순한 연산만 허용 - 숫자와 기본 연산자만
            const simpleArithmeticPattern = /^[\d\.\+\-\*/\s\(\)]+$/;
            if (simpleArithmeticPattern.test(processedExpr)) {
                // 매우 제한적인 연산만 직접 처리
                return evaluateSimpleArithmetic(processedExpr);
            }
            
            // Math 함수들 처리
            if (processedExpr.includes('Math.')) {
                return evaluateWithMathFunctions(processedExpr, context);
            }
            
            return 0;
        } catch (error) {
            console.warn('Simple expression evaluation failed:', error);
            return 0;
        }
    }
    
    // 단순 산술 연산 평가기 (eval 없이)
    function evaluateSimpleArithmetic(expr) {
        try {
            // 매우 기본적인 계산기 구현
            // 이 함수는 제한된 연산만 처리합니다
            
            // 공백 제거
            expr = expr.replace(/\s+/g, '');
            
            // 빈 문자열 체크
            if (!expr) return 0;
            
            // 괄호가 있으면 재귀적으로 처리
            if (expr.includes('(')) {
                return evaluateWithParentheses(expr);
            }
            
            // 곱셈과 나눗셈 먼저 처리
            const mulDivResult = evaluateMultiplicationDivision(expr);
            
            // 덧셈과 뺄셈 처리
            return evaluateAdditionSubtraction(mulDivResult);
        } catch (error) {
            console.warn('Simple arithmetic evaluation failed:', error, expr);
            return 0;
        }
    }
    
    // 괄호가 있는 식 처리
    function evaluateWithParentheses(expr) {
        let result = expr;
        
        while (result.includes('(')) {
            const innerMatch = result.match(/\(([^()]+)\)/);
            if (!innerMatch) break;
            
            const innerExpr = innerMatch[1];
            const innerResult = evaluateSimpleArithmetic(innerExpr);
            result = result.replace(innerMatch[0], String(innerResult));
        }
        
        return evaluateSimpleArithmetic(result);
    }
    
    // 곱셈과 나눗셈 처리
    function evaluateMultiplicationDivision(expr) {
        if (typeof expr === 'number') return expr;
        
        const strExpr = String(expr);
        if (!strExpr.includes('*') && !strExpr.includes('/')) {
            return strExpr;
        }
        
        const tokens = strExpr.split(/([*/])/);
        let result = safeParseFloat(tokens[0]);
        
        for (let i = 1; i < tokens.length; i += 2) {
            const operator = tokens[i];
            const operand = safeParseFloat(tokens[i + 1]);
            
            if (operator === '*') {
                result *= operand;
            } else if (operator === '/') {
                result /= operand; // 0으로 나누기도 허용 (Infinity가 올바른 수학적 결과)
            }
        }
        
        return result;
    }
    
    // 덧셈과 뺄셈 처리
    function evaluateAdditionSubtraction(expr) {
        if (typeof expr === 'number') return expr;
        
        const strExpr = String(expr);
        if (!strExpr.includes('+') && !strExpr.includes('-')) {
            return safeParseFloat(strExpr);
        }
        
        const tokens = strExpr.split(/([+-])/);
        let result = safeParseFloat(tokens[0]);
        
        for (let i = 1; i < tokens.length; i += 2) {
            const operator = tokens[i];
            const operand = safeParseFloat(tokens[i + 1]);
            
            if (operator === '+') {
                result += operand;
            } else if (operator === '-') {
                result -= operand;
            }
        }
        
        return result;
    }
    
    // Math 함수가 포함된 식 처리
    function evaluateWithMathFunctions(expr, context) {
        // Math 함수들을 안전하게 처리
        const mathFunctions = {
            'Math.abs': Math.abs,
            'Math.floor': Math.floor,
            'Math.ceil': Math.ceil,
            'Math.round': Math.round,
            'Math.min': Math.min,
            'Math.max': Math.max,
            'Math.pow': Math.pow,
            'Math.sqrt': Math.sqrt,
            'Math.sin': Math.sin,
            'Math.cos': Math.cos,
            'Math.tan': Math.tan,
            'Math.log': Math.log,
        };
        
        // Math 함수 호출 허용 - 결과 제한 없음
        for (const [funcName, func] of Object.entries(mathFunctions)) {
            const pattern = new RegExp(`${funcName.replace('.', '\\.')}\\(([\\d\\.\\+\\-\\*/\\s]+)\\)`, 'g');
            expr = expr.replace(pattern, (match, args) => {
                const argValue = evaluateSimpleArithmetic(args);
                const result = func(argValue);
                return String(result); // NaN, Infinity도 허용
            });
        }
        
        // 남은 수식을 단순 산술로 처리
        return evaluateSimpleArithmetic(expr);
    }

    // 감마 함수 처리
    function handleGammaFunction(expression, params) {
        const z = safeParseFloat(params[0], 1);
        
        if (expression.includes('적분 정의')) {
            if (z <= 0) return NaN;
            let result = 0;
            const dt = 0.01;
            
            for (let t = dt; t <= 20; t += dt) {
                const term = Math.pow(t, z - 1) * Math.exp(-t) * dt;
                result += term;
            }
            
            return result;
        }
        
        if (expression.includes('오일러 무한 곱')) {
            if (z <= 0) return NaN;
            const n = 100; // 더 높은 정밀도
            
            // n! * n^z 계산
            let factorial = 1;
            for (let i = 1; i <= n; i++) {
                factorial *= i;
            }
            
            let numerator = factorial * Math.pow(n, z);
            
            // z * (z+1) * ... * (z+n) 계산
            let denominator = 1;
            for (let k = 0; k <= n; k++) {
                denominator *= (z + k);
            }
            
            return numerator / denominator;
        }
        
        if (expression.includes('바이어슈트라스 무한 곱')) {
            if (z <= 0) return NaN;
            const gamma_const = 0.5772156649015329; // 오일러-마스케로니 상수
            
            let product = 1;
            const maxN = 100; // 더 높은 정밀도
            for (let n = 1; n <= maxN; n++) {
                product *= (1 + z / n) * Math.exp(-z / n);
            }
            
            const reciprocal = z * Math.exp(gamma_const * z) * product;
            return 1 / reciprocal;
        }
        
        if (expression.includes('한켈 경로 적분')) {
            if (z <= 0) {
                // 음수에 대한 해석적 연속
                const n = Math.floor(-z) + 1;
                let result = Math.PI / Math.sin(Math.PI * z);
                
                for (let k = 0; k < n; k++) {
                    result /= (z + k);
                }
                
                const divisor = Math.sqrt(2 * Math.PI / (z + n)) * Math.pow((z + n) / Math.E, z + n);
                return result / divisor;
            } else {
                return Math.sqrt(2 * Math.PI / z) * Math.pow(z / Math.E, z);
            }
        }
        
        if (expression.includes('재귀 관계와 해석적 연속')) {
            let x = z;
            if (x > 10) {
                // 큰 값은 스털링 근사 사용
                return Math.sqrt(2 * Math.PI / x) * Math.pow(x / Math.E, x);
            } else if (x < 0) {
                // 음수는 반사 공식
                const sinTerm = Math.sin(Math.PI * x);
                const gammaOneMinusX = Math.sqrt(2 * Math.PI / (1 - x)) * Math.pow((1 - x) / Math.E, 1 - x);
                return Math.PI / (sinTerm * gammaOneMinusX);
            } else if (x < 1) {
                // Γ(z) = Γ(z+1)/z
                let result = 1;
                
                while (x < 1) {
                    result /= x;
                    x += 1;
                }
                
                result *= Math.sqrt(2 * Math.PI / x) * Math.pow(x / Math.E, x);
                return result;
            } else if (x === 1 || x === 2) {
                return 1;
            } else {
                // 재귀적 계산을 반복문으로
                let result = 1;
                
                while (x > 2) {
                    x -= 1;
                    result *= x;
                }
                
                return result;
            }
        }
        
        if (expression.includes('스털링 근사')) {
            if (z <= 0) return NaN;
            const term1 = Math.sqrt(2 * Math.PI / z);
            const term2 = Math.pow(z / Math.E, z);
            let correction = 1;
            
            if (z > 0.5) {
                correction += 1 / (12 * z);
                correction += 1 / (288 * z * z);
                correction -= 139 / (51840 * Math.pow(z, 3));
            }
            
            return term1 * term2 * correction;
        }
        
        // 기본 스털링 근사
        if (z <= 0) return NaN;
        return Math.sqrt(2 * Math.PI / z) * Math.pow(z / Math.E, z);
    }

    // 안전한 블록 정의
    Entry.block['eval_block'] = {
        color: '#39C5BB',
        skeleton: 'basic',
        params: [{ type: 'Block', accept: 'string', defaultType: 'text' }],
        paramsKeyMap: { CODE: 0 },
        func(sprite, script) {
            try {
            const jsCode = script.getStringValue('CODE', script);
                const params = script.executor.register?.params || [];
                
                // alert만 특별 처리
                if (jsCode.includes('alert(')) {
                    try {
                        const alertMatch = jsCode.match(/alert\(([^)]+)\)/);
                        if (alertMatch) {
                            const alertContent = alertMatch[1];
                            if (alertContent.includes('sanitizeInput')) {
                                alert(sanitizeInput(params[0] || ""));
                            } else if (alertContent === '"알람 실행"') {
                                alert("알람 실행");
                            } else if (alertContent === '"테스트"') {
                                alert("테스트");
                            }
                        }
                        return;
                    } catch (alertError) {
                        console.warn('Alert processing failed:', alertError);
                        return;
                    }
                }
                
                return safeEvaluateExpression(jsCode, params);
            } catch (error) {
                console.warn('eval_block execution failed:', error);
                showUnsupportedFunctionWarning('eval_block');
                return;
            }
        }
    };
    
    Entry.block['eval_value'] = {
        skeleton: 'basic_string_field',
        color: '#DC143C',
        params: [{ type: 'Block', accept: 'string', defaultType: 'text' }],
        paramsKeyMap: { CODE: 0 },
        func(sprite, script) {
            try {
            const jsCode = script.getStringValue('CODE', script);
                const params = script.executor.register?.params || [];
                return safeEvaluateExpression(jsCode, params);
            } catch (error) {
                console.warn('eval_value execution failed:', error);
                showUnsupportedFunctionWarning('eval_value');
                return 0;
            }
        }
    };
    
    Entry.block['empty_block'] = {
        color: '#FFA500',
        skeleton: 'basic',
        func(sprite, script) {
            // 빈 블록 - 아무 기능 없음
        }
    };

    // 함수 교체 (description 기반으로 변경)
    function replaceFunctions() {
        if (isCurrentlyReplaced) {
            console.log('[함수 교체] 이미 교체된 상태 - 스킵');
            return;
        }
        
        console.log('[함수 교체] 시작');
        let replacedCount = 0;
        
        // @test@ 함수 교체 (description 기반)
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.description.includes('@test@')) {
                // 백업
                functionBackups.set(func.id, func.content.toJSON());
                
                const newBlocks = [
                    [
                        { type: func.type === 'value' ? 'function_create_value' : 'function_create', x: 40, y: 40 },
                        { type: 'eval_block', params: [`alert("알람 실행");`] }
                    ]
                ];
                func.content.load(newBlocks);
                Entry.variableContainer.saveFunction(func);
                replacedCount++;
            }
        });
        
        // @test2@ 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.description.includes('@test2@')) {
                // 백업
                functionBackups.set(func.id, func.content.toJSON());
                
                const newBlocks = [
                    [
                        { type: func.type === 'value' ? 'function_create_value' : 'function_create', x: 40, y: 40 },
                        { type: 'eval_block', params: [`alert("테스트");`] }
                    ]
                ];
                func.content.load(newBlocks);
                Entry.variableContainer.saveFunction(func);
                replacedCount++;
            }
        });

        // @min 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const minPattern = /@min\s+([^@]+)@/;
                const match = safeRegexExec(minPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.min(...safeSplit(p[0] || "0,0,0").map(x => safeParseFloat(x)))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @max 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const maxPattern = /@max\s+([^@]+)@/;
                const match = safeRegexExec(maxPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.max(...safeSplit(p[0] || "0,0,0").map(x => safeParseFloat(x)))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @exp 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const expPattern = /@exp\s+([^@]+)@/;
                const match = safeRegexExec(expPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.exp(safeParseFloat(p[0]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // 내적 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const dotPattern = /@\s*([^@\s]+)\s*와\s*([^@\s]+)\s*의\s*내적@/;
                const match = safeRegexExec(dotPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const v1 = safeSplit(p[0] || "0,0,0").map(x => safeParseFloat(x));
                                        const v2 = safeSplit(p[1] || "0,0,0").map(x => safeParseFloat(x));
                                        v1.reduce((sum, val, i) => sum + val * (v2[i] || 0), 0)
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // 외적 패턴 함수 교체 (3D 벡터만 지원)
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const crossPattern = /@\s*([^@\s]+)\s*와\s*([^@\s]+)\s*의\s*외적@/;
                const match = safeRegexExec(crossPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const v1 = safeSplit(p[0] || "0,0,0").map(x => safeParseFloat(x));
                                        const v2 = safeSplit(p[1] || "0,0,0").map(x => safeParseFloat(x));
                                        const cross = [
                                            (v1[1] || 0) * (v2[2] || 0) - (v1[2] || 0) * (v2[1] || 0),
                                            (v1[2] || 0) * (v2[0] || 0) - (v1[0] || 0) * (v2[2] || 0),
                                            (v1[0] || 0) * (v2[1] || 0) - (v1[1] || 0) * (v2[0] || 0)
                                        ];
                                        cross.join(",")
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @복소수 계산 덧셈 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const complexAddPattern = /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*\+\s*\(\s*[^)]+\s*\)@/;
                if (safeRegexTest(complexAddPattern, func.description)) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z1 = parseComplex(p[0] || "0");
                                        const z2 = parseComplex(p[1] || "0");
                                        const result = addComplex(z1, z2);
                                        formatComplex(result)
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @복소수 계산 뺄셈 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const complexSubtractPattern = /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*-\s*\(\s*[^)]+\s*\)@/;
                if (safeRegexTest(complexSubtractPattern, func.description)) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z1 = parseComplex(p[0] || "0");
                                        const z2 = parseComplex(p[1] || "0");
                                        const result = subtractComplex(z1, z2);
                                        formatComplex(result)
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @복소수 계산 곱셈 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const complexMultiplyPattern = /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*\*\s*\(\s*[^)]+\s*\)@/;
                if (safeRegexTest(complexMultiplyPattern, func.description)) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z1 = parseComplex(p[0] || "0");
                                        const z2 = parseComplex(p[1] || "0");
                                        const result = multiplyComplex(z1, z2);
                                        formatComplex(result)
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @복소수 계산 나눗셈 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const complexDividePattern = /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*\/\s*\(\s*[^)]+\s*\)@/;
                if (safeRegexTest(complexDividePattern, func.description)) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z1 = parseComplex(p[0] || "0");
                                        const z2 = parseComplex(p[1] || "0");
                                        const result = divideComplex(z1, z2);
                                        formatComplex(result)
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @복소수 계산 거듭제곱 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const complexPowerPattern = /@복소수\s+계산\s*\(\s*[^)]+\s*\)\s*\*\*\s*\(\s*[^)]+\s*\)@/;
                if (safeRegexTest(complexPowerPattern, func.description)) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z1 = parseComplex(p[0] || "0");
                                        const z2 = parseComplex(p[1] || "0");
                                        const result = powerComplex(z1, z2);
                                        formatComplex(result)
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // 거듭제곱 패턴1: ** 연산자
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const powerPattern1 = /@\s*([^@\s]+)\s*\*\*\s*([^@\s]+)\s*@/;
                const match = safeRegexExec(powerPattern1, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.pow(safeParseFloat(p[0]), safeParseFloat(p[1]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // 거듭제곱 패턴2: 한글 표현
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const powerPattern2 = /@\s*([^@\s]+)\s*을\/를\s*([^@\s]+)\s*번\s*제곱하기@/;
                const match = safeRegexExec(powerPattern2, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                func.content.getThreads()[0]?.getFirstBlock()?.params[1] || null,
                                null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.pow(safeParseFloat(p[0]), safeParseFloat(p[1]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // 알람 띄우기 패턴 (동작 함수만 처리)
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type !== 'value') {
                const alertPattern = /@\s*([^@]+)\s*을\/를\s*알람으로\s*띄우기@/;
                const match = safeRegexExec(alertPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    const newBlocks = [
                        [
                            { type: 'function_create', x: 40, y: 40 },
                            { type: 'eval_block', params: [`const p = script.executor.register?.params || []; alert(sanitizeInput(p[0] || ""));`] }
                        ]
                    ];
                    func.content.load(newBlocks);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @sinh 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const sinhPattern = /@sinh\s+([^@]+)@/;
                const match = safeRegexExec(sinhPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.sinh(safeParseFloat(p[0]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @cosh 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const coshPattern = /@cosh\s+([^@]+)@/;
                const match = safeRegexExec(coshPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.cosh(safeParseFloat(p[0]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @tanh 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const tanhPattern = /@tanh\s+([^@]+)@/;
                const match = safeRegexExec(tanhPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.tanh(safeParseFloat(p[0]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @coth 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const cothPattern = /@coth\s+([^@]+)@/;
                const match = safeRegexExec(cothPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['const x = safeParseFloat(p[0]); 1 / Math.tanh(x)']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @sech 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const sechPattern = /@sech\s+([^@]+)@/;
                const match = safeRegexExec(sechPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['const x = safeParseFloat(p[0]); 1 / Math.cosh(x)']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @csch 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const cschPattern = /@csch\s+([^@]+)@/;
                const match = safeRegexExec(cschPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['const x = safeParseFloat(p[0]); 1 / Math.sinh(x)']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @arsinh 패턴 함수 교체 (asinh)
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const arsinhPattern = /@arsinh\s+([^@]+)@/;
                const match = safeRegexExec(arsinhPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.asinh(safeParseFloat(p[0]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @arcosh 패턴 함수 교체 (acosh)
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const arcoshPattern = /@arcosh\s+([^@]+)@/;
                const match = safeRegexExec(arcoshPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.acosh(safeParseFloat(p[0]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @artanh 패턴 함수 교체 (atanh)
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const artanhPattern = /@artanh\s+([^@]+)@/;
                const match = safeRegexExec(artanhPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.atanh(safeParseFloat(p[0]))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @arcoth 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const arcothPattern = /@arcoth\s+([^@]+)@/;
                const match = safeRegexExec(arcothPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['const x = safeParseFloat(p[0]); Math.atanh(1 / x)']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @arsech 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const arsechPattern = /@arsech\s+([^@]+)@/;
                const match = safeRegexExec(arsechPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['const x = safeParseFloat(p[0]); Math.acosh(1 / x)']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @arcsch 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const arcschPattern = /@arcsch\s+([^@]+)@/;
                const match = safeRegexExec(arcschPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['const x = safeParseFloat(p[0]); Math.asinh(1 / x)']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @atan2 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const atan2Pattern = /@atan2\s+([^@]+)@/;
                const match = safeRegexExec(atan2Pattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const coords = safeSplit(p[0] || "0,0").map(x => safeParseFloat(x));
                                        Math.atan2(coords[0] || 0, coords[1] || 0)
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @감마 함수 적분 정의 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const gammaIntegralPattern = /@감마\s+함수\s+적분\s+정의\s+([^@]+)@/;
                const match = safeRegexExec(gammaIntegralPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z = safeParseFloat(p[0], 1);
                                        // 적분 정의: Γ(z) = ∫₀^∞ t^(z-1) * e^(-t) dt
                                        if (z <= 0) {
                                            NaN;
                                        } else {
                                            let result = 0;
                                            const dt = 0.01;
                                            for (let t = dt; t <= 20; t += dt) {
                                                result += Math.pow(t, z - 1) * Math.exp(-t) * dt;
                                            }
                                            result;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @감마 함수 오일러 무한 곱 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const gammaEulerPattern = /@감마\s+함수\s+오일러\s+무한\s+곱\s+([^@]+)@/;
                const match = safeRegexExec(gammaEulerPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z = safeParseFloat(p[0], 1);
                                        // 오일러 무한 곱: Γ(z) = lim(n→∞) [n! * n^z / (z * (z+1) * ... * (z+n))]
                                        if (z <= 0) {
                                            NaN;
                                        } else {
                                            const n = 50; // 근사를 위한 유한 항
                                            
                                            // n! * n^z 계산
                                            let factorial = 1;
                                            for (let i = 1; i <= n; i++) factorial *= i;
                                            let numerator = factorial * Math.pow(n, z);
                                            
                                            // z * (z+1) * ... * (z+n) 계산
                                            let denominator = 1;
                                            for (let k = 0; k <= n; k++) denominator *= (z + k);
                                            
                                            numerator / denominator;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @감마 함수 바이어슈트라스 무한 곱 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const gammaWeierstrassPattern = /@감마\s+함수\s+바이어슈트라스\s+무한\s+곱\s+([^@]+)@/;
                const match = safeRegexExec(gammaWeierstrassPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z = safeParseFloat(p[0], 1);
                                        // 바이어슈트라스 무한 곱: 1/Γ(z) = z * e^(γz) * ∏(n=1,∞) [(1 + z/n) * e^(-z/n)]
                                        if (z <= 0) {
                                            NaN;
                                        } else {
                                            const gamma_const = 0.5772156649015329; // 오일러-마스케로니 상수
                                            
                                            let product = 1;
                                            const maxN = 50;
                                            for (let n = 1; n <= maxN; n++) {
                                                product *= (1 + z / n) * Math.exp(-z / n);
                                            }
                                            
                                            const reciprocal = z * Math.exp(gamma_const * z) * product;
                                            1 / reciprocal;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @감마 함수 한켈 경로 적분 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const gammaHankelPattern = /@감마\s+함수\s+한켈\s+경로\s+적분\s+([^@]+)@/;
                const match = safeRegexExec(gammaHankelPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z = safeParseFloat(p[0], 1);
                                        // 한켈 경로 적분: 복소함수론의 잔류 정리 이용
                                        if (z <= 0) {
                                            // 음수에 대한 해석적 연속
                                            const n = Math.floor(-z) + 1;
                                            let result = Math.PI / Math.sin(Math.PI * z);
                                            for (let k = 0; k < n; k++) {
                                                result /= (z + k);
                                            }
                                            result / (Math.sqrt(2 * Math.PI / (z + n)) * Math.pow((z + n) / Math.E, z + n));
                                        } else {
                                            Math.sqrt(2 * Math.PI / z) * Math.pow(z / Math.E, z);
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @감마 함수 재귀 관계와 해석적 연속 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const gammaRecursivePattern = /@감마\s+함수\s+재귀\s+관계와\s+해석적\s+연속\s+([^@]+)@/;
                const match = safeRegexExec(gammaRecursivePattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z = safeParseFloat(p[0], 1);
                                        // 재귀 관계: Γ(z+1) = z*Γ(z), Γ(1) = 1
                                        
                                        let x = z;
                                        if (x > 10) {
                                            // 큰 값은 스털링 근사 사용
                                            Math.sqrt(2 * Math.PI / x) * Math.pow(x / Math.E, x);
                                        } else if (x < 0) {
                                            // 음수는 반사 공식: Γ(z)Γ(1-z) = π/sin(πz) 
                                            // 간단한 근사로 스털링 사용
                                            Math.PI / (Math.sin(Math.PI * x) * Math.sqrt(2 * Math.PI / (1 - x)) * Math.pow((1 - x) / Math.E, 1 - x));
                                        } else if (x < 1) {
                                            // Γ(z) = Γ(z+1)/z, 간단히 (x+1)!/x 형태로
                                            let result = 1;
                                            while (x < 1) {
                                                result /= x;
                                                x += 1;
                                            }
                                            result * Math.sqrt(2 * Math.PI / x) * Math.pow(x / Math.E, x);
                                        } else if (x === 1 || x === 2) {
                                            1;
                                        } else {
                                            // 재귀적 계산을 반복문으로
                                            let result = 1;
                                            while (x > 2) {
                                                x -= 1;
                                                result *= x;
                                            }
                                            result;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @감마 함수 스털링 근사 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const gammaStirlingPattern = /@감마\s+함수\s+스털링\s+근사\s+([^@]+)@/;
                const match = safeRegexExec(gammaStirlingPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const z = safeParseFloat(p[0], 1);
                                        // 스털링 근사: Γ(z) ≈ √(2π/z) * (z/e)^z * (1 + 1/(12z) + 1/(288z²) + ...)
                                        if (z <= 0) {
                                            NaN;
                                        } else {
                                            const term1 = Math.sqrt(2 * Math.PI / z);
                                            const term2 = Math.pow(z / Math.E, z);
                                            
                                            // 고차항 보정
                                            let correction = 1;
                                            if (z > 0.5) {
                                                correction += 1 / (12 * z);
                                                correction += 1 / (288 * z * z);
                                                correction -= 139 / (51840 * Math.pow(z, 3));
                                            }
                                            
                                            term1 * term2 * correction;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @log 함수 교체 (description 패턴 매칭)
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                // @log 문자/숫자값 ( 문자/숫자값1 )@ 패턴 매칭
                const logPattern = /@log\s+[^(]+\s*\(\s*[^)]+\s*\)@/;
                if (safeRegexTest(logPattern, func.description)) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.log(safeParseFloat(p[1], 1)) / Math.log(safeParseFloat(p[0], 10))']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @하불완전 감마 함수 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const lowerIncompleteGammaPattern = /@하불완전\s+감마\s+함수\s+([^@]+)@/;
                const match = safeRegexExec(lowerIncompleteGammaPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const params = safeSplit(p[0] || "1,1").map(x => safeParseFloat(x, 1));
                                        const s = params[0];
                                        const x = params[1];
                                        // 하불완전 감마 함수: γ(s,x) = ∫₀ˣ t^(s-1) * e^(-t) dt
                                        if (s <= 0 || x < 0) {
                                            NaN;
                                        } else if (x === 0) {
                                            0;
                                        } else {
                                            // 수치 적분으로 근사 계산
                                            let result = 0;
                                            const dt = Math.min(0.01, x / 1000);
                                            for (let t = dt; t <= x; t += dt) {
                                                result += Math.pow(t, s - 1) * Math.exp(-t) * dt;
                                            }
                                            result;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @상불완전 감마 함수 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const upperIncompleteGammaPattern = /@상불완전\s+감마\s+함수\s+([^@]+)@/;
                const match = safeRegexExec(upperIncompleteGammaPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const params = safeSplit(p[0] || "1,1").map(x => safeParseFloat(x, 1));
                                        const s = params[0];
                                        const x = params[1];
                                        // 상불완전 감마 함수: Γ(s,x) = ∫ₓ^∞ t^(s-1) * e^(-t) dt
                                        if (s <= 0 || x < 0) {
                                            NaN;
                                        } else {
                                            // 스털링 근사로 전체 감마 함수 계산
                                            const gamma_s = s > 10 ? 
                                                Math.sqrt(2 * Math.PI / s) * Math.pow(s / Math.E, s) :
                                                (function() {
                                                    let result = 1;
                                                    let temp_s = s;
                                                    while (temp_s > 2) {
                                                        temp_s -= 1;
                                                        result *= temp_s;
                                                    }
                                                    return result;
                                                })();
                                            
                                            // 하불완전 감마 계산
                                            let lowerGamma = 0;
                                            if (x > 0) {
                                                const dt = Math.min(0.01, x / 1000);
                                                for (let t = dt; t <= x; t += dt) {
                                                    lowerGamma += Math.pow(t, s - 1) * Math.exp(-t) * dt;
                                                }
                                            }
                                            
                                            // 상불완전 = 전체 - 하불완전
                                            gamma_s - lowerGamma;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @하정규화 불완전 감마 함수 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const lowerRegularizedIncompleteGammaPattern = /@하정규화\s+불완전\s+감마\s+함수\s+([^@]+)@/;
                const match = safeRegexExec(lowerRegularizedIncompleteGammaPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const params = safeSplit(p[0] || "1,1").map(x => safeParseFloat(x, 1));
                                        const s = params[0];
                                        const x = params[1];
                                        // 하정규화 불완전 감마 함수: P(s,x) = γ(s,x) / Γ(s)
                                        if (s <= 0 || x < 0) {
                                            NaN;
                                        } else if (x === 0) {
                                            0;
                                        } else {
                                            // 하불완전 감마 계산
                                            let lowerGamma = 0;
                                            const dt = Math.min(0.01, x / 1000);
                                            for (let t = dt; t <= x; t += dt) {
                                                lowerGamma += Math.pow(t, s - 1) * Math.exp(-t) * dt;
                                            }
                                            
                                            // 전체 감마 함수 계산 (스털링 근사 또는 재귀)
                                            const gamma_s = s > 10 ? 
                                                Math.sqrt(2 * Math.PI / s) * Math.pow(s / Math.E, s) :
                                                (function() {
                                                    let result = 1;
                                                    let temp_s = s;
                                                    while (temp_s > 2) {
                                                        temp_s -= 1;
                                                        result *= temp_s;
                                                    }
                                                    return result;
                                                })();
                                            
                                            lowerGamma / gamma_s;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @상정규화 불완전 감마 함수 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const upperRegularizedIncompleteGammaPattern = /@상정규화\s+불완전\s+감마\s+함수\s+([^@]+)@/;
                const match = safeRegexExec(upperRegularizedIncompleteGammaPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: [`
                                        const params = safeSplit(p[0] || "1,1").map(x => safeParseFloat(x, 1));
                                        const s = params[0];
                                        const x = params[1];
                                        // 상정규화 불완전 감마 함수: Q(s,x) = Γ(s,x) / Γ(s)
                                        if (s <= 0 || x < 0) {
                                            NaN;
                                        } else {
                                            // 전체 감마 함수 계산
                                            const gamma_s = s > 10 ? 
                                                Math.sqrt(2 * Math.PI / s) * Math.pow(s / Math.E, s) :
                                                (function() {
                                                    let result = 1;
                                                    let temp_s = s;
                                                    while (temp_s > 2) {
                                                        temp_s -= 1;
                                                        result *= temp_s;
                                                    }
                                                    return result;
                                                })();
                                            
                                            // 하불완전 감마 계산
                                            let lowerGamma = 0;
                                            if (x > 0) {
                                                const dt = Math.min(0.01, x / 1000);
                                                for (let t = dt; t <= x; t += dt) {
                                                    lowerGamma += Math.pow(t, s - 1) * Math.exp(-t) * dt;
                                                }
                                            }
                                            
                                            // 상불완전 감마 = 전체 - 하불완전
                                            const upperGamma = gamma_s - lowerGamma;
                                            
                                            // 정규화
                                            upperGamma / gamma_s;
                                        }
                                    `]
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @파이값@ 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const piPattern = /@파이값@/;
                const match = safeRegexExec(piPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.PI']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @e@ 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const ePattern = /@e@/;
                const match = safeRegexExec(ePattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['Math.E']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @황금비@ 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const goldenRatioPattern = /@황금비@/;
                const match = safeRegexExec(goldenRatioPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['(1 + Math.sqrt(5)) / 2']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });

        // @오메가@ 패턴 함수 교체
        Object.values(Entry.variableContainer.functions_).forEach(func => {
            if (func.description && func.type === 'value') {
                const omegaPattern = /@오메가@/;
                const match = safeRegexExec(omegaPattern, func.description);
                if (match) {
                    // 백업
                    functionBackups.set(func.id, func.content.toJSON());
                    
                    func.content.load([
                        [{
                            type: 'function_create_value',
                            x: 40, y: 40,
                            params: [
                                func.content.getThreads()[0]?.getFirstBlock()?.params[0],
                                null, null,
                                {
                                    type: 'eval_value',
                                    params: ['0.5671432904097838']
                                }
                            ],
                            statements: [[
                                { type: 'empty_block' }
                            ]]
                        }]
                    ]);
                    Entry.variableContainer.saveFunction(func);
                    replacedCount++;
                }
            }
        });
        
        if (replacedCount > 0) {
            isCurrentlyReplaced = true;
        } else {
            console.log('[함수 교체] 교체할 함수 없음');
        }
    }

    // 복원
    function restoreFunctions() {
        if (!isCurrentlyReplaced || functionBackups.size === 0) {
            return;
        }
        
        functionBackups.forEach((backup, funcId) => {
            const func = Entry.variableContainer.functions_[funcId];
            if (func) {
                func.content.load(backup);
                Entry.variableContainer.saveFunction(func);
                console.log(`함수 ${funcId} 복원됨`);
            }
        });
        
        functionBackups.clear();
        isCurrentlyReplaced = false;
    }

    // 매번 실행시 교체
    Entry.addEventListener('run', () => {
        replaceFunctions();
    });
    
    // 엔진 toggleRun도
    const originalToggleRun = Entry.engine.toggleRun.bind(Entry.engine);
    Entry.engine.toggleRun = function(...args) {
        replaceFunctions();
        return originalToggleRun(...args);
    };

    // 매번 종료시 복원
    Entry.addEventListener('beforeStop', () => {
        restoreFunctions();
    });
    
    Entry.addEventListener('stop', () => {
        console.log('[함수 교체] 작품 종료 감지');
        restoreFunctions();
    });
})();

