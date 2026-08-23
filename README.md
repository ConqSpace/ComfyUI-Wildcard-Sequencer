# ComfyUI Wildcard Sequencer

여러 와일드카드 프롬프트를 한 노드에서 정리하고, 템플릿당 공통 이미지 수에 따라 순서대로 실행하는 ComfyUI 커스텀 노드입니다.

```text
[Wildcard Template Manager] ─> [Wildcard Sequencer] ─> CLIP Text Encode
  ├─ portrait of __characters__       ┐
  ├─ __styles/lighting__ photo...     ├─ 템플릿당 50장
  └─ cinematic __camera/angle__       ┘  1회전 합계 150장
```

## 주요 기능

- 한 Manager 노드에서 템플릿 추가, 삭제, 드래그 정렬
- 와일드카드 목록 새로고침과 서버 기준 폴더 선택 불러오기
- Manager 노드의 세로 길이에 맞춰 템플릿 목록과 검색 결과 영역 확장
- 각 템플릿에 와일드카드 하나, 여러 와일드카드, 일반 문장을 자유롭게 조합
- `{red|blue|green}` 인라인 랜덤 선택과 중첩 선택 지원
- 불편한 파일 드롭다운 대신 공유 검색창에서 와일드카드 토큰명 검색
- 검색 결과 클릭 또는 `Enter`로 현재 커서 위치에 `__token__, ` 자동 삽입
- Sequencer에서 지정한 공통 이미지 수만큼 실행한 뒤 다음 행으로 이동
- 마지막 행까지 실행하면 처음부터 다시 순환
- 새 Queue 작업마다 첫 번째 행부터 다시 시작
- 이미지마다 각 와일드카드를 독립적으로 무작위 추첨
- 중첩 와일드카드 및 하위 폴더 지원

## 설치

ComfyUI의 `custom_nodes` 폴더에서 저장소를 복제합니다.

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/ConqSpace/ComfyUI-Wildcard-Sequencer.git
```

ComfyUI를 재시작하고 브라우저를 강력 새로고침하세요. 별도 Python 패키지는 필요하지 않습니다.

이 확장은 최신 ComfyUI V3 노드 API를 사용하므로 최신 버전의 ComfyUI를 권장합니다.

## 빠른 사용법

1. `Wildcard Template Manager`와 `Wildcard Sequencer`를 하나씩 추가합니다.
2. Manager의 `+ 템플릿`으로 행을 만들고 프롬프트를 입력합니다. `폴더 불러오기`를 누르면 서버가 인식한 폴더를 탐색할 수 있습니다.
3. `≡` 핸들을 드래그해 실행 순서를 정합니다. 필요 없는 행은 `×`로 제거합니다.
4. Manager의 `templates` 출력을 Sequencer의 `templates` 입력에 연결합니다.
5. Sequencer의 `템플릿당 이미지 수`를 설정합니다. 이 수량이 모든 템플릿에 동일하게 적용됩니다.
6. Sequencer의 `prompt` 출력을 `CLIP Text Encode`에 연결합니다.
7. `Empty Latent Image` 등의 `batch_size`를 `1`로 설정합니다.
8. ComfyUI의 Run/Queue Batch Count에 전체 생성량을 입력하고 Queue를 실행합니다.

`토큰 찾기`를 펼치고 검색 결과를 선택하면 마지막으로 편집한 프롬프트의 커서 위치에 `__token__, `이 들어갑니다. 연속으로 선택하면 `__character__, __lighting__, `처럼 바로 나열됩니다. 검색은 경로나 파일 내용이 아니라 토큰명만 대상으로 하며, 여러 단어는 모두 포함된 결과만 보여줍니다.

## 실행 예시

```text
A: portrait of __characters__                    50장
B: __styles/lighting__ photo of __characters__  50장
C: cinematic __camera/angle__                   50장
```

Run/Queue Batch Count가 `100`이면 A 50장 다음 B 50장을 생성하고 C에는 도달하지 않습니다. `150`장이면 A → B → C를 각각 50장씩 실행합니다. `200`장이면 다음처럼 다시 A로 순환합니다.

```text
0~49     A
50~99    B
100~149  C
150~199  A
```

Queue 버튼을 다시 누르면 이전 작업의 다음 순서가 아니라 A의 첫 번째 이미지부터 새 작업으로 시작합니다.

## 노드

### Wildcard Template Manager

- 행 하나가 완성된 프롬프트 템플릿 하나입니다.
- 행 안에는 일반 문장과 `__wildcard__` 토큰을 원하는 만큼 섞을 수 있습니다.
- `≡` 드래그 순서가 실행 순서이며 `×`를 누르면 그 행이 순환에서 빠집니다.
- `↻`은 폴더를 다시 스캔해 검색 목록만 갱신하며 기존 템플릿은 건드리지 않습니다.
- `폴더 불러오기`는 노드 밖의 모달에서 서버 기준 폴더를 탐색합니다.
- `현재 폴더 추가`는 선택한 폴더에 직접 들어 있는 와일드카드만 파일당 한 행으로 추가합니다. 하위 폴더는 자동으로 포함하지 않으며 이미 포함된 토큰은 건너뜁니다.
- 출력은 전용 `WILDCARD_TEMPLATE_SEQUENCE` 타입입니다.

### Wildcard Sequencer

- Manager 출력 하나만 받습니다.
- `템플릿당 이미지 수` 하나를 모든 Manager 행에 공통으로 적용합니다.
- ComfyUI 기본 숫자 위젯을 사용하며 별도의 커스텀 패널을 표시하지 않습니다.
- 읽기 전용 기본 위젯에 `3개 × 50장 = 150장` 형식으로 1회전 합계를 표시합니다.
- `seed`와 작업 내 이미지 번호가 같으면 같은 결과를 재현합니다.
- Queue 작업이 새로 시작되면 순서 카운터는 0으로 초기화됩니다.
- 작업 내 이미지 번호와 Queue 작업 ID는 브라우저 확장이 자동으로 기록합니다.

v0.4의 템플릿별 수량표와 v0.5의 공통 수량 데이터는 새 기본 숫자 위젯으로 자동 승계됩니다. 그 이전 Manager 워크플로는 첫 행의 이미지 수를 사용합니다. 초기 버전의 `Wildcard Template` 여러 개와 Autogrow 방식 `Wildcard Sequencer`도 저장된 워크플로 호환을 위해 deprecated 노드로 남아 있습니다.

## 와일드카드 파일

기본 와일드카드 폴더 탐색 순서는 다음과 같습니다.

1. `ComfyUI/wildcards`
2. 이 확장의 `wildcards`
3. 현재 작업 디렉터리의 `wildcards`

Manager 노드의 고급 입력 `와일드카드 폴더`에서 절대 경로나 다른 상대 경로를 지정할 수도 있습니다.

```text
wildcards/
├─ characters.txt
└─ styles/
   └─ lighting.txt
```

각 텍스트 파일은 한 줄을 하나의 후보로 사용합니다.

```text
# 이 줄은 주석입니다.
knight
wizard
__styles/lighting__ archer
```

프롬프트에서 다음 형식을 사용할 수 있습니다.

```text
__characters__
__styles/lighting__
__styles/lighting.txt__
{red|blue|green} hair
{portrait|{close-up|wide shot}}
```

- `{a|b}`는 실행마다 항목 하나를 무작위로 선택
- 선택식 안의 와일드카드와 중첩 선택식 재귀 전개
- UTF-8 및 UTF-8 BOM 지원
- 빈 줄과 첫 비공백 문자가 `#`인 줄 무시
- 선택된 항목 안의 중첩 와일드카드 재귀 전개
- 같은 토큰이 여러 번 나오면 각각 독립 추첨
- 없는 파일이나 빈 파일은 토큰 원문을 유지하고 서버 로그에 경고
- `../`, 절대 경로 토큰, 루트 밖 심볼릭 링크 차단
- 순환 참조와 과도한 재귀 차단

## 이미지 수 계산 시 주의사항

현재 버전은 정확한 할당량을 위해 **Queue 실행 한 번이 이미지 한 장을 생성하는 워크플로**를 대상으로 합니다.

- Run/Queue Batch Count `100` + latent `batch_size=1` → 서로 다른 프롬프트 요청 100개
- latent `batch_size=100` 한 번 → 하나의 문자열 프롬프트가 100장 전체에 적용되어 템플릿 경계를 나눌 수 없음

따라서 `Empty Latent Image` 등에서 `batch_size=1`을 사용하고, 여러 장은 ComfyUI의 Run/Queue Batch Count로 등록하세요.

할당량은 성공적으로 저장된 파일 수가 아니라 Queue에 제출된 이미지 요청 수를 기준으로 합니다. 후단 샘플링이나 저장 단계에서 실패한 이미지는 Sequencer가 알 수 없습니다.

## 개발 및 테스트

```powershell
py -3.12 -m unittest discover -s tests -v
node --check web/wildcard_ui.js
node --check web/template_manager_ui.js
node --check web/sequencer_ui.js
node --check web/folder_picker_ui.js
node tests/test_prompt_editing.mjs
node tests/test_template_ui.mjs
```

테스트는 템플릿·공통 수량 직렬화, 현재 폴더 판별과 중복 제거, 경계와 재순환, 연결 제거, 시드 재현성, 인라인 선택식, 토큰 삽입, 중첩 와일드카드, 경로 이탈 및 순환 참조 방지를 검증합니다.
