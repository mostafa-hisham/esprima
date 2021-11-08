/*
  Copyright JS Foundation and other contributors, https://js.foundation/

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
  THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import { CommentHandler } from './comment-handler';
import { JSXParser } from './jsx-parser';
import { Parser } from './parser';
import { Tokenizer } from './tokenizer';
import {Token} from "./token";

export function parse(code: string, options, delegate) {
    let commentHandler: CommentHandler | null = null;
    const proxyDelegate = (node, metadata) => {
        if (delegate) {
            delegate(node, metadata);
        }
        if (commentHandler) {
            commentHandler.visit(node, metadata);
        }
    };

    let parserDelegate = (typeof delegate === 'function') ? proxyDelegate : null;
    let collectComment = false;
    if (options) {
        collectComment = (typeof options.comment === 'boolean' && options.comment);
        const attachComment = (typeof options.attachComment === 'boolean' && options.attachComment);
        if (collectComment || attachComment) {
            commentHandler = new CommentHandler();
            commentHandler.attach = attachComment;
            options.comment = true;
            parserDelegate = proxyDelegate;
        }
    }

    let isModule = false;
    if (options && typeof options.sourceType === 'string') {
        isModule = (options.sourceType === 'module');
    }

    let parser: Parser;
    if (options && typeof options.jsx === 'boolean' && options.jsx) {
        parser = new JSXParser(code, options, parserDelegate);
    } else {
        parser = new Parser(code, options, parserDelegate);
    }

    const program = isModule ? parser.parseModule() : parser.parseScript();
    const ast = program as any;

    if (collectComment && commentHandler) {
        ast.comments = commentHandler.comments;
    }
    if (parser.config.tokens) {
        ast.tokens = parser.tokens;
    }
    if (parser.config.tolerant) {
        ast.errors = parser.errorHandler.errors;
    }

    return ast;
}

export function parseModule(code: string, options, delegate) {
    const parsingOptions = options || {};
    parsingOptions.sourceType = 'module';
    return parse(code, parsingOptions, delegate);
}

export function parseScript(code: string, options, delegate) {
    const parsingOptions = options || {};
    parsingOptions.sourceType = 'script';
    return parse(code, parsingOptions, delegate);
}

export function tokenize(code: string, options, delegate) {
    const tokenizer = new Tokenizer(code, options);

    const tokens: any = [];

    try {
        while (true) {
            let token = tokenizer.getNextToken();
            if (!token) {
                break;
            }
            if (delegate) {
                token = delegate(token);
            }
            tokens.push(token);
        }
    } catch (e) {
        tokenizer.errorHandler.tolerate(e);
    }

    if (tokenizer.errorHandler.tolerant) {
        tokens.errors = tokenizer.errors();
    }

    return tokens;
}

export function tokenizeC(code: string, options, delegate) {
    const tokenizer = new Tokenizer(code, options);

    let tokens: any = [];
    let new_tokens: any = [];

    try {
        while (true) {
            let token = tokenizer.getNextToken();
            if (
                !token || token.value == "" ||
                (token.type !== 'Identifier' && token.type !== 'Template' && token.type !== 'String')
            ) {
                break;
            }
            const value = String(token.value);
            const type = String(token.type);
            if (token.type === 'String') {
                // cut single/double quotes from the string
                // because esprima wraps string to a string
                const unwrappedString = value.slice(
                    1,
                    value.length - 1
                );
                let split_arr = unwrappedString.split(' ');
                split_arr.forEach(function (element, index) {

                    if (element.substring(0, 1) =="'" || element.substring(0, 1) =='"') {
                        element = element.slice(
                            1,
                            element.length - 1
                        );
                    }
                    tokens.push({
                        'type':type,
                        'value':element
                    });
                }, split_arr);
                break;
            }else if (token.type === 'Template') {
                // cut backticks from the template
                const len = value.length;
                const isOpenedTemplate = value[0] === '`';
                const isClosedTemplate = value[len - 1] === '`';
                const unwrappedTemplate = value.slice(
                    isOpenedTemplate ? 1 : 0,
                    isClosedTemplate ? len - 1 : len
                );
                let split_arr = unwrappedTemplate.split(' ');
                split_arr.forEach(function (element, index) {
                    if (element.substring(0, 1) =="'" || element.substring(0, 1) =='"') {
                        element = element.slice(
                            1,
                            element.length - 1
                        );
                    }
                    tokens.push({
                        'type':type,
                        'value':element
                    });
                }, split_arr);
                break;
            }
            if (delegate) {
                token = delegate(token);
            }

            tokens.push(token);
        }
    } catch (e) {
        tokenizer.errorHandler.tolerate(e);
    }

    if (tokenizer.errorHandler.tolerant) {
        tokens.errors = tokenizer.errors();
    }
    //tokens = [...new_tokens()];
    return tokens;
}

export {Syntax} from './syntax';

// Sync with *.json manifests.
export const version = '4.0.0-dev';
