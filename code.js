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

    // JavaScript 실행 블록 정의
    Entry.block['eval_block'] = {
        color: '#39C5BB',
        skeleton: 'basic',
        params: [{ type: 'Block', accept: 'string', defaultType: 'text' }],
        paramsKeyMap: { CODE: 0 },
        func(sprite, script) {
            const jsCode = script.getStringValue('CODE', script);
            return eval(jsCode);
        }
    };
    
    Entry.block['eval_value'] = {
        skeleton: 'basic_string_field',
        color: '#DC143C',
        params: [{ type: 'Block', accept: 'string', defaultType: 'text' }],
        paramsKeyMap: { CODE: 0 },
        func(sprite, script) {
            const jsCode = script.getStringValue('CODE', script);
            const p = script.executor.register?.params || [];
            return eval(jsCode);
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

