# ComfyUI Wildcard Sequencer

와일드카드를 검색해서 프롬프트 템플릿을 만들고, 템플릿별 이미지 할당량에 따라 순서대로 실행하는 ComfyUI 커스텀 노드입니다.

```text
[Wildcard Template A · 50장] ─┐
[Wildcard Template B · 50장] ─┼─> [Wildcard Sequencer] ─> CLIP Text Encode
[Wildcard Template C · 50장] ─┘
```

## 주요 기능

- 와일드카드, 여러 와일드카드의 조합, 일반 문장과 와일드카드의 조합 지원
- 불편한 파일 드롭다운 대신 파일명·경로·항목 내용 검색
- 검색 패널을 접어 Template 노드를 작게 유지하고, 노드별 열림 상태 저장
- 검색 결과 클릭 또는 `Enter`로 현재 커서 위치에 토큰 삽입
- 각 템플릿에 지정한 이미지 수만큼 실행한 뒤 다음 템플릿으로 이동
- 마지막 템플릿까지 실행하면 처음부터 다시 순환
- 새 Queue 작업마다 첫 번째 템플릿부터 다시 시작
- 이미지마다 각 와일드카드를 독립적으로 무작위 추첨
- 중첩 와일드카드 및 하위 폴더 지원

## 설치

ComfyUI의 `custom_nodes` 폴더에서 저장소를 복제합니다.

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/ConqSpace/ComfyUI-Wildcard-Sequencer.git
```

ComfyUI를 재시작하고 브라우저를 강력 새로고침하세요. 별도 Python 패키지는 필요하지 않습니다.

이 확장은 최신 ComfyUI V3 노드 API와 Autogrow 입력을 사용하므로 최신 버전의 ComfyUI를 권장합니다.

## 빠른 사용법

1. `Wildcard Template` 노드를 필요한 만큼 추가합니다.
2. 각 노드에 프롬프트와 `이미지 수`를 설정합니다.
3. Template 노드들을 `Wildcard Sequencer`에 실행할 순서대로 연결합니다.
4. Sequencer의 `prompt` 출력을 `CLIP Text Encode`에 연결합니다.
5. `Empty Latent Image` 등의 `batch_size`를 `1`로 설정합니다.
6. ComfyUI의 Run/Queue Batch Count에 전체 생성량을 입력하고 Queue를 실행합니다.

연결을 끊은 Template은 즉시 순서에서 제외됩니다. 중간 연결을 제거해도 남은 연결끼리 빈자리 없이 다시 순환합니다.

## 실행 예시

```text
A: portrait of __characters__                    50장
B: __styles/lighting__ photo of __characters__  50장
C: cinematic __camera/angle__                   50장
```

Run/Queue Batch Count가 `100`이면:

```text
0~49   A
50~99  B
```

총 생성량이 100장이므로 C에는 도달하지 않습니다. `150`장이면 A → B → C를 각각 50장씩 실행하고, `200`장이면 다음처럼 다시 A로 순환합니다.

```text
0~49     A
50~99    B
100~149  C
150~199  A
```

Queue 버튼을 다시 누르면 이전 작업의 다음 순서가 아니라 A의 첫 번째 이미지부터 새 작업으로 시작합니다.

## 노드

### Wildcard Template

- 일반 문장과 `__wildcard__` 토큰을 함께 작성합니다.
- 검색 결과에서 와일드카드를 선택하면 프롬프트 편집기의 현재 커서 위치에 삽입됩니다.
- `와일드카드 검색` 헤더를 누르면 검색 패널을 열거나 닫을 수 있습니다.
- 패널을 펼치면 검색창에 자동으로 포커스되며, 저장한 워크플로를 다시 열어도 노드별 상태가 복원됩니다.
- 최근 사용한 와일드카드를 별도로 표시합니다.
- 해당 템플릿을 연속으로 사용할 이미지 수를 설정합니다.
- 출력은 전용 `WILDCARD_TEMPLATE` 타입이므로 일반 문자열 소켓과 섞이지 않습니다.

### Wildcard Sequencer

- Template을 연결할 때마다 입력 소켓이 자동으로 늘어납니다.
- 연결된 소켓 순서가 실행 순서입니다.
- `seed`와 작업 내 이미지 번호가 같으면 같은 결과를 재현합니다.
- Queue 작업이 새로 시작되면 순서 카운터는 0으로 초기화됩니다.

## 와일드카드 파일

기본 와일드카드 폴더 탐색 순서는 다음과 같습니다.

1. `ComfyUI/wildcards`
2. 이 확장의 `wildcards`
3. 현재 작업 디렉터리의 `wildcards`

Template 노드의 고급 입력 `와일드카드 폴더`에서 절대 경로나 다른 상대 경로를 지정할 수도 있습니다.

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
```

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
```

현재 테스트는 템플릿 경계와 재순환, 연결 제거, 시드 재현성, 중첩 와일드카드, 경로 이탈 및 순환 참조 방지를 검증합니다.
